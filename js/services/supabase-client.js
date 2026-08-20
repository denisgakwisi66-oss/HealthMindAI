/**
 * ============================================
 * HEALTHMIND AI — SUPABASE CLIENT
 * ============================================
 * Lazily creates a single Supabase client, configured from the backend's
 * public config endpoint (never hardcode the project URL/anon key here —
 * they come from backend/.env via GET /api/config/public).
 */

let clientPromise = null;

const createSupabaseClient = async () => {
  const [{ createClient }, configResponse] = await Promise.all([
    import('https://esm.sh/@supabase/supabase-js@2'),
    fetch('/api/config/public'),
  ]);

  if (!configResponse.ok) {
    throw new Error('Could not load Supabase configuration from the server.');
  }
  const config = await configResponse.json();
  return createClient(config.supabase_url, config.supabase_anon_key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
};

export const getSupabase = () => {
  if (!clientPromise) {
    clientPromise = createSupabaseClient();
  }
  return clientPromise;
};

export default getSupabase;
