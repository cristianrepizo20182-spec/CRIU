from pathlib import Path

content = """/*
  WE'T–PI Café · Cliente Supabase
  Login real con Supabase Auth + perfiles/roles
*/

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ddvonqgouftgpxvmnveu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkdm9ucWdvdWZ0Z3B4dm1tZXUiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc4Nzg3MDI4NywiZXhwIjoyMTAzNDQ2Mjg3fQ._tumoC5lYq0CWhSu-SiWaOxOYFNx0AGGFSFI8hU7EBk';

const configured =
  !!SUPABASE_URL &&
  !!SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes('TU-PROJECT-REF') &&
  !SUPABASE_ANON_KEY.includes('TU_ANON_KEY');

const supabase = configured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

async function fetchProfile(userId) {
  if (!supabase) {
    throw new Error('Supabase no está configurado.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('role, full_name, active')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('ERROR AL LEER profiles:', error);
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
    throw new Error(
      'Falta configurar SUPABASE_URL y SUPABASE_ANON_KEY en supabase-client.js.'
    );
  }

  const cleanEmail = String(email || '').trim();

  if (!cleanEmail || !password) {
    throw new Error('Ingresa correo y contraseña.');
  }

  console.log('[WE\\'T–PI] Intentando login:', cleanEmail);
  console.log('[WE\\'T–PI] Supabase URL:', SUPABASE_URL);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password
  });

  if (error) {
    console.error('[WE\\'T–PI] ERROR REAL DE SUPABASE AUTH:', error);

    const status = error.status ? ` (HTTP ${error.status})` : '';
    throw new Error(`${error.message || 'Error de autenticación'}${status}`);
  }

  if (!data?.user) {
    throw new Error('Supabase no devolvió un usuario después del login.');
  }

  console.log('[WE\\'T–PI] Login Auth exitoso:', data.user.id);

  return await fetchProfile(data.user.id);
}

async function getSession() {
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error('ERROR AL RECUPERAR SESIÓN:', error);
    return null;
  }

  if (!data.session) return null;

  try {
    return await fetchProfile(data.session.user.id);
  } catch (e) {
    console.error('ERROR AL CARGAR PERFIL DE SESIÓN:', e);
    return null;
  }
}

async function signOut() {
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('ERROR AL CERRAR SESIÓN:', error);
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

path = Path("/mnt/data/supabase-client.js")
path.write_text(content, encoding="utf-8")
print(f"Archivo creado: {path}")
