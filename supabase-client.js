from pathlib import Path

js = r"""/*
  WE'T–PI Café · Cliente Supabase
  Login real con Supabase Auth + perfiles/roles
*/

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ddvonqgouftgpxvmnveu.supabase.co';

// Clave pública actual de Supabase (Publishable Key).
// NUNCA colocar aquí una sb_secret_ o service_role key.
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_B-wd3blQek7o6YSjOv0p3w_F8V13Vzu';

const configured =
  !!SUPABASE_URL &&
  !!SUPABASE_PUBLISHABLE_KEY &&
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_PUBLISHABLE_KEY.startsWith('sb_secret_');

const supabase = configured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

async function fetchProfile(userId) {
  if (!supabase) throw new Error('Supabase no está configurado.');

  const { data, error } = await supabase
    .from('profiles')
    .select('role, full_name, active')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[WE\'T–PI] ERROR AL LEER profiles:', error);
    throw new Error(
      `Autenticación correcta, pero no se pudo cargar el perfil: ${error.message}`
    );
  }

  if (!data.active) {
    throw new Error('Tu usuario está inactivo. Contacta al administrador.');
  }

  return {
    role: data.role,
    full_name: data.full_name || 'Usuario'
  };
}

async function signIn(email, password) {
  if (!supabase) {
    throw new Error('Supabase no está configurado correctamente.');
  }

  const cleanEmail = String(email || '').trim();

  if (!cleanEmail || !password) {
    throw new Error('Ingresa correo y contraseña.');
  }

  console.log('[WE\'T–PI] Intentando login:', cleanEmail);
  console.log('[WE\'T–PI] Supabase URL:', SUPABASE_URL);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password
  });

  if (error) {
    console.error('[WE\'T–PI] ERROR REAL DE SUPABASE AUTH:', error);
    throw new Error(
      `${error.message || 'Error de autenticación'}${error.status ? ` (HTTP ${error.status})` : ''}`
    );
  }

  if (!data?.user) {
    throw new Error('Supabase no devolvió un usuario después del login.');
  }

  console.log('[WE\'T–PI] Login Auth exitoso:', data.user.id);

  return await fetchProfile(data.user.id);
}

async function getSession() {
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error('[WE\'T–PI] ERROR AL RECUPERAR SESIÓN:', error);
    return null;
  }

  if (!data.session) return null;

  try {
    return await fetchProfile(data.session.user.id);
  } catch (e) {
    console.error('[WE\'T–PI] ERROR AL CARGAR PERFIL DE SESIÓN:', e);
    return null;
  }
}

async function signOut() {
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('[WE\'T–PI] ERROR AL CERRAR SESIÓN:', error);
    throw error;
  }
}

window.wetSupabase = {
  supabase,
  configured,
  signIn,
  getSession,
  signOut
};

window.dispatchEvent(new Event('wetSupabaseReady'));
"""

path = Path("/mnt/data/supabase-client-corregido-v2.js")
path.write_text(js, encoding="utf-8")
print(f"Archivo creado: {path}")
