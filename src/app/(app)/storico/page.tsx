"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Modifica = {
  id: string;
  quando: string;
  utente: string | null;
  campo_modificato: string | null;
  valore_precedente: string | null;
  valore_nuovo: string | null;
  motivo: string | null;
  assegnazioni: {
    cantieri: { cliente: string } | null;
    posatori: { nome: string } | null;
  } | null;
};

function quandoLeggibile(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StoricoPage() {
  const [modifiche, setModifiche] = useState<Modifica[]>([]);
  const [pronto, setPronto] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    let attivo = true;
    supabase
      .from("modifiche")
      .select(
        "id, quando, utente, campo_modificato, valore_precedente, valore_nuovo, motivo, assegnazioni(cantieri(cliente), posatori(nome))"
      )
      .order("quando", { ascending: false })
      .limit(300)
      .then(({ data, error }) => {
        if (!attivo) return;
        if (error) setErrore(error.message);
        else setModifiche((data ?? []) as unknown as Modifica[]);
        setPronto(true);
      });
    return () => {
      attivo = false;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
      <h1 className="text-lg font-semibold text-gray-900">
        Storico modifiche{" "}
        <span className="text-gray-400">({modifiche.length})</span>
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Ogni spostamento di un&apos;assegnazione viene registrato qui: chi, quando,
        da quando a quando, e il motivo.
      </p>

      {errore && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errore}
        </p>
      )}

      {!pronto ? (
        <p className="mt-4 text-gray-500">Caricamento…</p>
      ) : modifiche.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-gray-200 p-6 text-center text-gray-500">
          Ancora nessuna modifica registrata. Sposta un&apos;assegnazione dalla
          timeline e comparirà qui.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {modifiche.map((m) => {
            const cliente = m.assegnazioni?.cantieri?.cliente ?? "Assegnazione rimossa";
            const posatore = m.assegnazioni?.posatori?.nome;
            const azione =
              m.campo_modificato === "posatore" ? "Riassegnato" : "Spostato";
            return (
              <li
                key={m.id}
                className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium text-gray-900">
                    {cliente}
                    {posatore ? (
                      <span className="font-normal text-gray-500"> · {posatore}</span>
                    ) : null}
                  </p>
                  <span className="shrink-0 text-xs text-gray-400">
                    {quandoLeggibile(m.quando)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-700">
                  {azione}:{" "}
                  <span className="text-gray-500">{m.valore_precedente}</span>
                  {" → "}
                  <span className="font-medium text-gray-900">{m.valore_nuovo}</span>
                </p>
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-400">
                  {m.utente && <span>da {m.utente}</span>}
                  {m.motivo && (
                    <span className="text-amber-700">motivo: {m.motivo}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
