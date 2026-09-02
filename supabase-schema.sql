-- ============================================================
-- WE'T–PI Café · Esquema base para Supabase
-- Ejecuta este script en: Supabase → SQL Editor → New query → Run
-- Es el punto de partida para migrar los datos desde localStorage
-- a la nube (compartidos entre meseras y administrador, con respaldo).
-- ============================================================

-- ---------- 0. INSTALACIÓN LIMPIA ----------
-- Borra tablas previas (de intentos anteriores) para evitar conflictos de tipos.
-- ⚠️ En una PRIMERA instalación es seguro. Si ya tienes DATOS reales en estas
--    tablas, NO ejecutes esta sección (borra su contenido).
drop table if exists public.sale_items          cascade;
drop table if exists public.sales               cascade;
drop table if exists public.cash_movements      cascade;
drop table if exists public.inventory_movements cascade;
drop table if exists public.receptions          cascade;
drop table if exists public.shifts              cascade;
drop table if exists public.equipment           cascade;
drop table if exists public.customers           cascade;
drop table if exists public.products            cascade;
drop table if exists public.profiles            cascade;

-- ---------- 1. PERFILES (control de acceso por rol) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'waiter' check (role in ('admin','waiter','cashier')),
  active boolean not null default true,
  created_at timestamptz default now()
);

-- Crea automáticamente el perfil al registrarse un usuario en Authentication
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'waiter');
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Recrea el perfil de los usuarios que ya existían en Authentication
insert into public.profiles (id, full_name, role)
select id, coalesce(raw_user_meta_data->>'full_name', email), 'waiter'
from auth.users
on conflict (id) do nothing;

-- ---------- 2. CATÁLOGOS Y OPERACIÓN ----------
create table if not exists public.products (
  id bigint generated always as identity primary key,
  name text not null,
  sku text,
  cls text not null default 'prepared' check (cls in ('prepared','retail','utensil')),
  category text,
  price numeric not null default 0,
  stock integer not null default 0,
  min integer not null default 5,
  emoji text,
  tax_rate numeric not null default 0,
  tax_class text,
  created_at timestamptz default now()
);

create table if not exists public.customers (
  id bigint generated always as identity primary key,
  name text not null,
  doc text unique,               -- documento único (evita duplicados)
  phone text,
  email text,
  purchases integer not null default 0,
  total numeric not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.equipment (
  id bigint generated always as identity primary key,
  name text not null,
  category text,
  qty integer not null default 1,
  status text not null default 'Operativo',
  location text,
  responsible text,
  value numeric not null default 0,
  acquired_date date,
  notes text,
  created_at timestamptz default now()
);

-- ---------- 3. TURNOS DE CAJA ----------
create table if not exists public.shifts (
  id bigint generated always as identity primary key,
  name text not null check (name in ('Mañana','Tarde')),
  responsible text not null,
  base numeric not null default 0,
  opened_by uuid references public.profiles(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  status text not null default 'open' check (status in ('open','closed')),
  -- totales congelados al cerrar
  ventas numeric, efectivo numeric, qr numeric, egresos numeric, efectivo_esperado numeric
);

create table if not exists public.cash_movements (
  id bigint generated always as identity primary key,
  shift_id bigint references public.shifts(id) on delete cascade,
  type text not null check (type in ('Ingreso','Egreso')),
  description text,
  amount numeric not null,
  method text,
  created_at timestamptz default now()
);

-- ---------- 4. VENTAS ----------
create table if not exists public.sales (
  id bigint generated always as identity primary key,
  number text not null unique,          -- consecutivo V-0100xx
  shift_id bigint references public.shifts(id),
  customer text default 'Consumidor final',
  seller text,
  method text not null check (method in ('Efectivo','QR')),
  sub numeric, tax8 numeric, tax19 numeric, total numeric not null,
  received numeric default 0, change numeric default 0,
  status text not null default 'PAGADA' check (status in ('PAGADA','ANULADA')),
  created_at timestamptz default now(),
  annulled_at timestamptz
);

create table if not exists public.sale_items (
  id bigint generated always as identity primary key,
  sale_id bigint references public.sales(id) on delete cascade,
  product_id bigint references public.products(id),
  name text, qty integer, price numeric
);

-- ---------- 5. INVENTARIO / RECEPCIONES ----------
create table if not exists public.receptions (
  id bigint generated always as identity primary key,
  number text not null unique,          -- REC-000xx
  supplier text, invoice text, origin text, notes text,
  total numeric default 0,
  created_at timestamptz default now()
);

create table if not exists public.inventory_movements (
  id bigint generated always as identity primary key,
  product_id bigint references public.products(id),
  product_name text,
  type text not null check (type in ('Entrada','Salida','Ajuste')),
  qty integer not null,
  origin text, "user" text, notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- 6. SEGURIDAD (RLS) — solo usuarios autenticados y activos
-- ============================================================
alter table public.profiles            enable row level security;
alter table public.products            enable row level security;
alter table public.customers           enable row level security;
alter table public.equipment           enable row level security;
alter table public.shifts              enable row level security;
alter table public.cash_movements      enable row level security;
alter table public.sales               enable row level security;
alter table public.sale_items          enable row level security;
alter table public.receptions          enable row level security;
alter table public.inventory_movements enable row level security;

-- Cada quien ve/edita su propio perfil
create policy "perfil propio - ver"     on public.profiles for select using (auth.uid() = id);
create policy "perfil propio - editar"  on public.profiles for update using (auth.uid() = id);

-- Helper: ¿el usuario está activo?
create or replace function public.is_active()
returns boolean language sql security definer stable as $$
  select coalesce((select active from public.profiles where id = auth.uid()), false);
$$;

-- Datos operativos: cualquier usuario activo puede leer y escribir.
-- (Si más adelante quieres que solo el admin borre, se ajustan estas políticas.)
do $$
declare t text;
begin
  foreach t in array array['products','customers','equipment','shifts','cash_movements','sales','sale_items','receptions','inventory_movements']
  loop
    execute format('create policy "acceso activo - %1$s" on public.%1$s for all using (public.is_active()) with check (public.is_active());', t);
  end loop;
end $$;

-- ============================================================
-- 7. PROMOVER TU PRIMER ADMINISTRADOR
--    (crea primero el usuario en Authentication → Users, luego:)
-- update public.profiles set role = 'admin', full_name = 'Nombre Admin'
--   where id = (select id from auth.users where email = 'correo-del-admin@wetpi.com');
-- ============================================================
