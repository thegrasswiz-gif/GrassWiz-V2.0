// ============================================
// SUPABASE CLIENT
// The anon/publishable key is safe to ship in the browser — access is
// enforced by Row Level Security (see sql/02-auth-policies.sql), not by
// keeping this key secret.
// ============================================
const SUPABASE_URL = 'https://wagenkuebbibgglpszio.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BcGGni8jVrhTT7fNja95dA_GVC3QV0j';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
