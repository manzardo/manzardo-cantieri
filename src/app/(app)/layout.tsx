"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// Layout condiviso per tutte le pagine "interne" (che richiedono il login).
// Controlla la sessione una volta sola e mostra la barra di navigazione.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let attivo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!attivo) return;
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setPronto(true);
    });

    // Se l'utente esce (o la sessione scade), torna al login.
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, sessione) => {
      if (!sessione) router.replace("/login");
    });

    return () => {
      attivo = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  async function esci() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!pronto) {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center p-6">
        <p className="text-gray-500">Caricamento…</p>
      </main>
    );
  }

  const vociMenu = [
    { href: "/timeline", label: "Timeline" },
    { href: "/cantieri", label: "Cantieri" },
    { href: "/posatori", label: "Posatori" },
    { href: "/storico", label: "Storico" },
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <nav className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-1 px-3 py-2">
          <span className="mr-2 hidden text-sm font-semibold text-gray-900 sm:block">
            Cantieri Manzardo
          </span>
          {vociMenu.map((v) => {
            const attiva = pathname.startsWith(v.href);
            return (
              <Link
                key={v.href}
                href={v.href}
                className={
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition " +
                  (attiva
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100")
                }
              >
                {v.label}
              </Link>
            );
          })}
          <button
            onClick={esci}
            className="ml-auto rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50"
          >
            Esci
          </button>
        </div>
      </nav>

      {children}
    </div>
  );
}
