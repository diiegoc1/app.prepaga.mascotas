import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "[supabaseClient] Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. " +
      "Local: definilas en .env (ver .env.example). " +
      "Vercel: Project Settings → Environment Variables.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
