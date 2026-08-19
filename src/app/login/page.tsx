"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(false);

  async function accedi(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setCaricamento(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setCaricamento(false);

    if (error) {
      // Messaggio in italiano, comprensibile.
      setErrore("Email o password non corretti. Riprova.");
      return;
    }

    // Accesso riuscito: vai alla home.
    router.replace("/");
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <form
        onSubmit={accedi}
        className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-gray-900">
          Programmazione Cantieri
        </h1>
        <p className="mt-1 text-sm text-gray-500">Ceramiche Manzardo — accesso</p>

        <label className="mt-6 block text-sm font-medium text-gray-700">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            placeholder="nome@esempio.it"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-gray-700">
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            placeholder="••••••••"
          />
        </label>

        {errore && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {errore}
          </p>
        )}

        <button
          type="submit"
          disabled={caricamento}
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {caricamento ? "Accesso in corso…" : "Entra"}
        </button>
      </form>
    </main>
  );
}
