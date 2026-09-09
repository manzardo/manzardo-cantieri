"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatData } from "@/lib/date";

// Pagina "Da assegnare": i cantieri che non hanno NESSUN posatore assegnato,
// in nessuna data. Serve a non dimenticarsi di fissare gli artigiani.
// Appena un cantiere riceve la prima assegnazione, sparisce da qui.

type Cantiere = {
  id: string;
  cliente: string;
  indirizzo: string | null;
  tipo_lavorazione: string | null;
  note: string | null;
  data_contratto: string | null;
  sopralluogo_fatto: boolean;
  merce_ordinata: boolean;
};

export default function DaAssegnarePage() {
  const [cantieri, setCantieri] = useState<Cantiere[]>([]);
  const [errore, setErrore] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let attivo = true;

    async function carica() {
      const [c, a] = await Promise.all([
        supabase
          .from("cantieri")
          .select(
            "id, cliente, indirizzo, tipo_lavorazione, note, data_contratto, sopralluogo_fatto, merce_ordinata"
          )
          .order("data_contratto", { ascending: true, nullsFirst: false }),
        supabase.from("assegnazioni").select("cantiere_id"),
      ]);

      if (!attivo) return;

      if (c.error || a.error) {
        setErrore(c.error?.message || a.error?.message || "Errore");
        setPronto(true);
        return;
      }

      // Gli id dei cantieri che hanno almeno un'assegnazione.
      const assegnati = new Set((a.data ?? []).map((x) => x.cantiere_id));
      setCantieri((c.data ?? []).filter((x) => !assegnati.has(x.id)));
      setPronto(true);
    }

    carica();
    return () => {
      attivo = false;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-gray-900">
          Da assegnare <span className="text-gray-400">({cantieri.length})</span>
        </h1>
        <Link
          href="/timeline"
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Vai alla timeline
        </Link>
      </div>

      <p className="mt-1 text-sm text-gray-500">
        Cantieri senza nessun posatore assegnato. Dal più vecchio al più recente.
      </p>

      {errore && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errore}
        </p>
      )}

      {!pronto ? (
        <p className="mt-4 text-gray-500">Caricamento…</p>
      ) : cantieri.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-green-300 bg-green-50 p-6 text-center text-green-800">
          ✓ Tutti i cantieri hanno almeno un posatore assegnato.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {cantieri.map((c) => (
            <li
              key={c.id}
              className="rounded-2xl border border-amber-300 bg-white p-4 shadow-sm ring-1 ring-amber-200"
            >
              <p className="font-semibold text-gray-900">{c.cliente}</p>
              <p className="text-sm text-gray-500">
                {[c.tipo_lavorazione, c.indirizzo].filter(Boolean).join(" · ") || "—"}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">
                Contratto: {formatData(c.data_contratto)}
              </p>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Stato attivo={c.sopralluogo_fatto} label="Sopralluogo" />
                <Stato attivo={c.merce_ordinata} label="Merce ordinata" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

// Pallino di stato, solo da leggere: si accende dalla pagina Cantieri.
function Stato({ attivo, label }: { attivo: boolean; label: string }) {
  return (
    <span
      className={
        "rounded-full px-3 py-1 font-medium " +
        (attivo
          ? "bg-green-100 text-green-800 ring-1 ring-green-300"
          : "bg-gray-100 text-gray-500 ring-1 ring-gray-200")
      }
    >
      {attivo ? "✓ " : "○ "}
      {label}
    </span>
  );
}
