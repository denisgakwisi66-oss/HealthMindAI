/**
 * ============================================
 * HEALTHMIND AI — SUPABASE CLIENT
 * ============================================
 * Lazily creates a single Supabase client, configured from the backend's
 * public config endpoint (never hardcode the project URL/anon key here —
 * they come from backend/.env via GET /api/config/public).
 */

import { apiUrl } from './api-url.js';

let clientPromise = null;

const createSupabaseClient = async () => {
  const [{ createClient }, configResponse] = await Promise.all([
    import('https://esm.sh/@supabase/supabase-js@2'),
    fetch(apiUrl('/api/config/public')),
  ]);

  if (!configResponse.ok) {
    let message = 'Could not load account service configuration from the server.';
    try {
      const error = await configResponse.json();
      message = error?.detail?.error?.message || error?.error?.message || message;
    } catch (error) {
      console.error('Could not read account service configuration error:', error);
    }
    throw new Error(message);
  }
  const config = await configResponse.json();
  if (!config?.supabase_url || !config?.supabase_anon_key) {
    throw new Error('Account services are not configured. Contact the site administrator.');
  }
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
