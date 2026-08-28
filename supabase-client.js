/*
  WE'T–PI Café · Cliente Supabase (login real por roles)
  ───────────────────────────────────────────────────────
  1. Reemplaza SUPABASE_URL y SUPABASE_ANON_KEY con los datos de tu proyecto
     (Supabase → Project Settings → API). Usa SOLO la anon/public key.
     NUNCA pongas la service_role key aquí (queda expuesta en el navegador).
  2. El login usa este archivo. Como importa la librería de Supabase por módulo,
     la app NO funciona con doble clic (file://): debes servir la carpeta.
     Ejemplos:  npx serve .    |    python -m http.server 5173
     o publicarla en un hosting (Vercel, Netlify, Supabase Storage, etc.).
  3. Crea los usuarios en Supabase → Authentication → Users. El primer perfil
     entra como 'waiter' (mesero). Promociona al administrador con el SQL indicado.
*/
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ddvonqgouftgpxvmnveu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_B-wd3blQek7o6YSjOv0p3w_F8V13Vzu';

const configured = !SUPABASE_URL.includes('TU-PROJECT-REF') && !SUPABASE_ANON_KEY.includes('sb_publishable_B-wd3blQek7o6YSjOv0p3w_F8V13Vzu');
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, full_name, active')
    .eq('id', userId)
    .single();
  if (error) throw new Error('No se encontró el perfil del usuario. Ejecuta el esquema SQL y vuelve a intentar.');
  if (!data.active) throw new Error('Tu usuario está inactivo. Contacta al administrador.');
  return { role: data.role, full_name: data.full_name || 'Usuario' };
}

async function signIn(email, password) {
  if (!supabase) throw new Error('Falta configurar SUPABASE_URL y SUPABASE_ANON_KEY en supabase-client.js.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Correo o contraseña incorrectos.');
  return await fetchProfile(data.user.id);
}

async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  try { return await fetchProfile(data.session.user.id); } catch (e) { return null; }
}

async function signOut() { if (supabase) await supabase.auth.signOut(); }

window.wetSupabase = { supabase, configured, signIn, getSession, signOut };
window.dispatchEvent(new Event('wetSupabaseReady'));
