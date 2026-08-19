import { createClient } from "@supabase/supabase-js";

// Cliente Supabase condiviso per tutta l'app (lato browser).
// Legge le chiavi dal file .env.local. Se mancano, si ferma con un messaggio
// chiaro invece di dare errori strani più avanti.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Chiavi Supabase mancanti: controlla il file .env.local (NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY)."
  );
}

export const supabase = createClient(url, anonKey);
