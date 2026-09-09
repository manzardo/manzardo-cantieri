"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Stesso ordine delle categorie usato nella timeline.
const ORDINE_MESTIERI = [
  "Piastrellista",
  "Parquettista",
  "Muratore",
  "Idraulico",
  "Elettricista",
  "Cartongessista/Pittore",
  "Montatore box doccia",
];

function pesoMestiere(m: string): number {
  if (m === "Da classificare") return 999;
  const i = ORDINE_MESTIERI.indexOf(m);
  return i === -1 ? 500 : i;
}

type Posatore = {
  id: string;
  nome: string;
  mestiere: string;
  tipo: "interno" | "terzista";
  telefono: string | null;
  colore: string;
  attivo: boolean;
};

export default function PosatoriPage() {
  const [posatori, setPosatori] = useState<Posatore[]>([]);
  const [errore, setErrore] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let attivo = true;
    supabase
      .from("posatori")
      .select("id, nome, mestiere, tipo, telefono, colore, attivo")
      .order("nome", { ascending: true })
      .then(({ data, error }) => {
        if (!attivo) return;
        if (error) setErrore(error.message);
        else setPosatori(data ?? []);
        setPronto(true);
      });
    return () => {
      attivo = false;
    };
  }, []);

  // Artigiani divisi per categoria (piastrellisti insieme, muratori insieme, ecc.)
  const gruppi = (() => {
    const mappa = new Map<string, Posatore[]>();
    for (const p of posatori) {
      const m = p.mestiere || "Da classificare";
      if (!mappa.has(m)) mappa.set(m, []);
      mappa.get(m)!.push(p);
    }
    return [...mappa.entries()]
      .map(([mestiere, elenco]) => ({ mestiere, elenco }))
      .sort(
        (a, b) =>
          pesoMestiere(a.mestiere) - pesoMestiere(b.mestiere) ||
          a.mestiere.localeCompare(b.mestiere)
      );
  })();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
      <h1 className="text-lg font-semibold text-gray-900">
        Artigiani / Posatori{" "}
        <span className="text-gray-400">({posatori.length})</span>
      </h1>

      {errore && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errore}
        </p>
      )}

      {!pronto ? (
        <p className="mt-4 text-gray-500">Caricamento…</p>
      ) : (
        <div className="mt-4 space-y-4">
          {gruppi.map((gr) => (
            <div key={gr.mestiere}>
              <h2 className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {gr.mestiere} · {gr.elenco.length}
              </h2>
              <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-white">
                {gr.elenco.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: p.colore }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900">{p.nome}</p>
                      <p className="truncate text-sm text-gray-500">
                        {p.tipo === "interno" ? "Interno" : "Terzista"}
                        {p.telefono ? ` · ${p.telefono}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
