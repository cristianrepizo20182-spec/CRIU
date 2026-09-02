-- ============================================================
-- WE'T–PI Café · Sincronización "respaldo en la nube"
-- Ejecuta este script DESPUÉS de supabase-schema.sql
-- (necesita la función public.is_active() creada allí).
-- Guarda todo el estado compartido de la app en una sola fila
-- y lo comparte en vivo entre dispositivos vía Realtime.
-- ============================================================

create table if not exists public.app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  updated_by text
);

alter table public.app_state enable row level security;

-- Cualquier usuario autenticado y activo puede leer y escribir el estado
drop policy if exists "app_state activos" on public.app_state;
create policy "app_state activos" on public.app_state
  for all using (public.is_active()) with check (public.is_active());

-- Habilita Realtime en la tabla (para que los cambios lleguen a todos)
do $$
begin
  begin
    alter publication supabase_realtime add table public.app_state;
  exception when duplicate_object then null;
  end;
end $$;

-- (Opcional) fila inicial vacía; la app la crea sola al primer guardado.
insert into public.app_state (id, data) values ('main', '{}'::jsonb)
  on conflict (id) do nothing;
