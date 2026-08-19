"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  addGiorni,
  giorniTra,
  isWeekend,
  letteraGiorno,
  lunediDellaSettimana,
  numeroGiorno,
  oggiISO,
  formatData,
} from "@/lib/date";

const GIORNI_VISIBILI = 28; // 4 settimane
const CELLA = 44; // larghezza di un giorno in pixel
const NOME = 128; // larghezza colonna nomi
const ALTEZZA_BLOCCO = 30;
const GAP = 4;
const ROSSO = "#dc2626"; // colore ferie / indisponibilità
const GIORNI_AVVISO = 20; // avviso: posa entro N giorni con prerequisiti mancanti (§4.6)

type Posatore = { id: string; nome: string; colore: string };
type Cantiere = { id: string; cliente: string };
type Assegnazione = {
  id: string;
  data_inizio: string;
  data_fine: string;
  posatore_id: string;
  cantiere_id: string;
  cantieri: {
    cliente: string;
    sopralluogo_fatto: boolean;
    merce_ordinata: boolean;
  } | null;
};
type Indisponibilita = {
  id: string;
  posatore_id: string;
  data_inizio: string;
  data_fine: string;
  motivo: string | null;
};

// Un "impegno" è una cosa che occupa dei giorni: un cantiere o una ferie.
type Impegno = {
  id: string;
  tipo: "cantiere" | "ferie";
  etichetta: string;
  posatore_id: string;
  data_inizio: string;
  data_fine: string;
  inizioIdx: number;
  fineIdx: number;
  corsia: number;
  rischio: boolean; // posa vicina con prerequisiti mancanti
};

type Riga = {
  pos: Posatore;
  impegni: Impegno[];
  corsie: number;
  rangeConflitti: { start: number; end: number }[];
};

function raggruppaContigui(indici: number[]): { start: number; end: number }[] {
  if (indici.length === 0) return [];
  const ordinati = [...indici].sort((a, b) => a - b);
  const gruppi: { start: number; end: number }[] = [];
  let start = ordinati[0];
  let prev = ordinati[0];
  for (let i = 1; i < ordinati.length; i++) {
    if (ordinati[i] === prev + 1) {
      prev = ordinati[i];
    } else {
      gruppi.push({ start, end: prev });
      start = prev = ordinati[i];
    }
  }
  gruppi.push({ start, end: prev });
  return gruppi;
}

export default function TimelinePage() {
  const [inizio, setInizio] = useState<string>(() =>
    lunediDellaSettimana(oggiISO())
  );
  const [posatori, setPosatori] = useState<Posatore[]>([]);
  const [cantieri, setCantieri] = useState<Cantiere[]>([]);
  const [assegnazioni, setAssegnazioni] = useState<Assegnazione[]>([]);
  const [indisponibilita, setIndisponibilita] = useState<Indisponibilita[]>([]);
  const [pronto, setPronto] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [pannello, setPannello] = useState<null | "cantiere" | "ferie">(null);
  const [dettaglio, setDettaglio] = useState<Impegno | null>(null);
  const [utente, setUtente] = useState<string>("");

  const oggi = oggiISO();
  const fine = addGiorni(inizio, GIORNI_VISIBILI - 1);
  const giorni = useMemo(
    () => Array.from({ length: GIORNI_VISIBILI }, (_, i) => addGiorni(inizio, i)),
    [inizio]
  );

  const carica = useCallback(async () => {
    setErrore(null);
    const { data: sess } = await supabase.auth.getSession();
    setUtente(sess.session?.user.email ?? "");
    const [p, c, a] = await Promise.all([
      supabase.from("posatori").select("id, nome, colore").eq("attivo", true).order("nome"),
      supabase.from("cantieri").select("id, cliente").order("cliente"),
      supabase
        .from("assegnazioni")
        .select(
          "id, data_inizio, data_fine, posatore_id, cantiere_id, cantieri(cliente, sopralluogo_fatto, merce_ordinata)"
        )
        .gte("data_fine", inizio)
        .lte("data_inizio", fine),
    ]);
    if (p.error || c.error || a.error) {
      setErrore(p.error?.message || c.error?.message || a.error?.message || "Errore");
    } else {
      setPosatori(p.data ?? []);
      setCantieri(c.data ?? []);
      setAssegnazioni((a.data ?? []) as unknown as Assegnazione[]);
    }

    // Indisponibilità: se la tabella non esiste ancora, si ignora senza rompere.
    const f = await supabase
      .from("indisponibilita")
      .select("id, posatore_id, data_inizio, data_fine, motivo")
      .gte("data_fine", inizio)
      .lte("data_inizio", fine);
    setIndisponibilita(f.error ? [] : (f.data ?? []));

    setPronto(true);
  }, [inizio, fine]);

  useEffect(() => {
    carica();
  }, [carica]);

  // Costruisce le righe: impegni per posatore, corsie e giorni in conflitto.
  const righe: Riga[] = useMemo(() => {
    return posatori.map((pos) => {
      const impegni: Impegno[] = [];
      for (const a of assegnazioni) {
        if (a.posatore_id !== pos.id) continue;
        const c = a.cantieri;
        const posaVicina =
          a.data_inizio >= oggi && a.data_inizio <= addGiorni(oggi, GIORNI_AVVISO);
        const rischio = !!(
          posaVicina &&
          c &&
          (!c.sopralluogo_fatto || !c.merce_ordinata)
        );
        impegni.push({
          id: a.id,
          tipo: "cantiere",
          etichetta: a.cantieri?.cliente ?? "Cantiere",
          posatore_id: pos.id,
          data_inizio: a.data_inizio,
          data_fine: a.data_fine,
          inizioIdx: giorniTra(inizio, a.data_inizio),
          fineIdx: giorniTra(inizio, a.data_fine),
          corsia: 0,
          rischio,
        });
      }
      for (const f of indisponibilita) {
        if (f.posatore_id !== pos.id) continue;
        impegni.push({
          id: f.id,
          tipo: "ferie",
          etichetta: f.motivo || "Ferie",
          posatore_id: pos.id,
          data_inizio: f.data_inizio,
          data_fine: f.data_fine,
          inizioIdx: giorniTra(inizio, f.data_inizio),
          fineIdx: giorniTra(inizio, f.data_fine),
          corsia: 0,
          rischio: false,
        });
      }
      impegni.sort((x, y) => x.data_inizio.localeCompare(y.data_inizio));

      // Corsie: impegni sovrapposti finiscono su righe affiancate.
      const fineCorsie: number[] = [];
      for (const im of impegni) {
        let c = fineCorsie.findIndex((f) => im.inizioIdx > f);
        if (c === -1) {
          c = fineCorsie.length;
          fineCorsie.push(im.fineIdx);
        } else {
          fineCorsie[c] = im.fineIdx;
        }
        im.corsia = c;
      }

      // Giorni in conflitto: coperti da 2 o più impegni.
      const giorniConflitto: number[] = [];
      for (let i = 0; i < GIORNI_VISIBILI; i++) {
        let n = 0;
        for (const im of impegni) if (im.inizioIdx <= i && im.fineIdx >= i) n++;
        if (n >= 2) giorniConflitto.push(i);
      }

      return {
        pos,
        impegni,
        corsie: Math.max(1, fineCorsie.length),
        rangeConflitti: raggruppaContigui(giorniConflitto),
      };
    });
  }, [posatori, assegnazioni, indisponibilita, inizio]);

  const conflitti = righe.filter((r) => r.rangeConflitti.length > 0);

  // Avvisi: cantieri con posa entro 20 giorni e sopralluogo/merce mancanti.
  const avvisi = useMemo(() => {
    const m = new Map<string, { cliente: string; data: string; mancano: string[] }>();
    const limite = addGiorni(oggi, GIORNI_AVVISO);
    for (const a of assegnazioni) {
      const c = a.cantieri;
      if (!c) continue;
      if (!(a.data_inizio >= oggi && a.data_inizio <= limite)) continue;
      const mancano: string[] = [];
      if (!c.sopralluogo_fatto) mancano.push("sopralluogo");
      if (!c.merce_ordinata) mancano.push("merce ordinata");
      if (mancano.length === 0) continue;
      const prec = m.get(a.cantiere_id);
      if (!prec || a.data_inizio < prec.data) {
        m.set(a.cantiere_id, { cliente: c.cliente, data: a.data_inizio, mancano });
      }
    }
    return [...m.values()].sort((x, y) => x.data.localeCompare(y.data));
  }, [assegnazioni, oggi]);

  const larghezzaGriglia = GIORNI_VISIBILI * CELLA;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 p-3 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-gray-900">Timeline</h1>
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setInizio(addGiorni(inizio, -7))}
            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            aria-label="Settimana precedente"
          >
            ‹
          </button>
          <button
            onClick={() => setInizio(lunediDellaSettimana(oggiISO()))}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Oggi
          </button>
          <button
            onClick={() => setInizio(addGiorni(inizio, 7))}
            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            aria-label="Settimana successiva"
          >
            ›
          </button>
          <button
            onClick={() => setPannello("ferie")}
            className="ml-1 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            + Ferie
          </button>
          <button
            onClick={() => setPannello("cantiere")}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Assegna
          </button>
        </div>
      </div>

      <p className="mt-1 text-sm text-gray-500">
        {formatData(inizio)} – {formatData(fine)}
      </p>

      {errore && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errore}
        </p>
      )}

      {/* Riepilogo conflitti */}
      {conflitti.length > 0 && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p className="font-semibold">
            ⚠ {conflitti.length}{" "}
            {conflitti.length === 1
              ? "artigiano con sovrapposizioni"
              : "artigiani con sovrapposizioni"}
          </p>
          <ul className="mt-1 space-y-0.5">
            {conflitti.map((r) => (
              <li key={r.pos.id}>
                <b>{r.pos.nome}</b>:{" "}
                {r.rangeConflitti
                  .map((g) =>
                    g.start === g.end
                      ? formatData(addGiorni(inizio, g.start))
                      : `${formatData(addGiorni(inizio, g.start))}–${formatData(
                          addGiorni(inizio, g.end)
                        )}`
                  )
                  .join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Riepilogo avvisi: posa vicina con prerequisiti mancanti */}
      {avvisi.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-semibold">
            ⚠ {avvisi.length}{" "}
            {avvisi.length === 1
              ? "cantiere con posa vicina e prerequisiti mancanti"
              : "cantieri con posa vicina e prerequisiti mancanti"}
          </p>
          <ul className="mt-1 space-y-0.5">
            {avvisi.map((a) => (
              <li key={a.cliente + a.data}>
                <b>{a.cliente}</b> — posa {formatData(a.data)} (manca{" "}
                {a.mancano.join(" e ")})
              </li>
            ))}
          </ul>
        </div>
      )}

      {!pronto ? (
        <p className="mt-4 text-gray-500">Caricamento…</p>
      ) : posatori.length === 0 ? (
        <p className="mt-6 text-gray-500">Nessun posatore attivo.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <div style={{ minWidth: NOME + larghezzaGriglia }}>
            {/* Intestazione con i giorni */}
            <div className="flex border-b border-gray-200">
              <div
                className="sticky left-0 z-10 shrink-0 border-r border-gray-200 bg-gray-50"
                style={{ width: NOME }}
              />
              <div className="flex">
                {giorni.map((g) => (
                  <div
                    key={g}
                    className={
                      "shrink-0 border-r border-gray-100 py-1 text-center " +
                      (g === oggi ? "bg-blue-50" : isWeekend(g) ? "bg-gray-50" : "bg-white")
                    }
                    style={{ width: CELLA }}
                  >
                    <div className="text-[10px] uppercase text-gray-400">
                      {letteraGiorno(g)}
                    </div>
                    <div
                      className={
                        "text-xs " +
                        (g === oggi ? "font-bold text-blue-700" : "text-gray-700")
                      }
                    >
                      {numeroGiorno(g)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Una riga per posatore */}
            {righe.map((r) => {
              const altezzaRiga = r.corsie * (ALTEZZA_BLOCCO + GAP) + GAP;
              return (
                <div key={r.pos.id} className="flex border-b border-gray-100">
                  <div
                    className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-gray-200 bg-white px-2"
                    style={{ width: NOME }}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: r.pos.colore }}
                    />
                    <span className="truncate text-sm text-gray-800">
                      {r.pos.nome}
                    </span>
                  </div>

                  <div
                    className="relative"
                    style={{ width: larghezzaGriglia, height: altezzaRiga }}
                  >
                    {/* Sfondo: celle dei giorni */}
                    <div className="absolute inset-0 flex">
                      {giorni.map((g) => (
                        <div
                          key={g}
                          className={
                            "shrink-0 border-r border-gray-100 " +
                            (g === oggi
                              ? "bg-blue-50/60"
                              : isWeekend(g)
                              ? "bg-gray-50"
                              : "")
                          }
                          style={{ width: CELLA }}
                        />
                      ))}
                    </div>

                    {/* Blocchi (cantieri e ferie) */}
                    {r.impegni.map((im) => {
                      const vsInizio = Math.max(0, im.inizioIdx);
                      const vsFine = Math.min(GIORNI_VISIBILI - 1, im.fineIdx);
                      const span = vsFine - vsInizio + 1;
                      const colore = im.tipo === "ferie" ? ROSSO : r.pos.colore;
                      return (
                        <button
                          key={im.tipo + im.id}
                          onClick={() => setDettaglio(im)}
                          title={`${im.etichetta} · ${formatData(im.data_inizio)} → ${formatData(im.data_fine)}`}
                          className={
                            "absolute overflow-hidden rounded-md px-1.5 text-left text-xs font-medium text-white shadow-sm transition hover:brightness-95 " +
                            (im.rischio ? "ring-2 ring-amber-400" : "ring-1 ring-black/10")
                          }
                          style={{
                            left: vsInizio * CELLA + 2,
                            width: span * CELLA - 4,
                            top: im.corsia * (ALTEZZA_BLOCCO + GAP) + GAP,
                            height: ALTEZZA_BLOCCO,
                            lineHeight: `${ALTEZZA_BLOCCO}px`,
                            backgroundColor: colore,
                          }}
                        >
                          {im.inizioIdx < 0 ? "‹ " : ""}
                          {im.rischio ? "⚠ " : ""}
                          {im.etichetta}
                          {im.fineIdx > GIORNI_VISIBILI - 1 ? " ›" : ""}
                        </button>
                      );
                    })}

                    {/* Evidenza rossa sui giorni di sovrapposizione (sopra i blocchi) */}
                    {r.rangeConflitti.map((g, i) => (
                      <div
                        key={"conf" + i}
                        className="pointer-events-none absolute top-0 rounded-sm ring-2 ring-red-500"
                        style={{
                          left: g.start * CELLA,
                          width: (g.end - g.start + 1) * CELLA,
                          height: altezzaRiga,
                          backgroundColor: "rgba(220,38,38,0.28)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legenda */}
      {pronto && posatori.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-blue-600" /> Cantiere
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: ROSSO }} />{" "}
            Ferie / lavoro proprio
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm ring-2 ring-red-500" style={{ backgroundColor: "rgba(220,38,38,0.28)" }} />{" "}
            Sovrapposizione (conflitto)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-blue-600 ring-2 ring-amber-400" />{" "}
            ⚠ Posa a rischio (prerequisiti mancanti)
          </span>
        </div>
      )}

      {pannello === "cantiere" && (
        <PannelloAssegna
          cantieri={cantieri}
          posatori={posatori}
          onChiudi={() => setPannello(null)}
          onSalvato={() => {
            setPannello(null);
            carica();
          }}
        />
      )}

      {pannello === "ferie" && (
        <PannelloFerie
          posatori={posatori}
          onChiudi={() => setPannello(null)}
          onSalvato={() => {
            setPannello(null);
            carica();
          }}
        />
      )}

      {dettaglio && (
        <DettaglioImpegno
          impegno={dettaglio}
          posatori={posatori}
          utente={utente}
          onChiudi={() => setDettaglio(null)}
          onAggiornato={carica}
          onEliminato={() => {
            setDettaglio(null);
            carica();
          }}
        />
      )}
    </main>
  );
}

function CampiData({
  dataInizio,
  dataFine,
  setDataInizio,
  setDataFine,
}: {
  dataInizio: string;
  dataFine: string;
  setDataInizio: (v: string) => void;
  setDataFine: (v: string) => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-3">
      <label className="block text-sm font-medium text-gray-700">
        Dal
        <input
          type="date"
          value={dataInizio}
          onChange={(e) => {
            setDataInizio(e.target.value);
            if (dataFine < e.target.value) setDataFine(e.target.value);
          }}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
      </label>
      <label className="block text-sm font-medium text-gray-700">
        Al
        <input
          type="date"
          value={dataFine}
          min={dataInizio}
          onChange={(e) => setDataFine(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
      </label>
    </div>
  );
}

function PannelloAssegna({
  cantieri,
  posatori,
  onChiudi,
  onSalvato,
}: {
  cantieri: Cantiere[];
  posatori: Posatore[];
  onChiudi: () => void;
  onSalvato: () => void;
}) {
  const [cantiereId, setCantiereId] = useState("");
  const [posatoreId, setPosatoreId] = useState("");
  const [dataInizio, setDataInizio] = useState(oggiISO());
  const [dataFine, setDataFine] = useState(oggiISO());
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    if (!cantiereId || !posatoreId) {
      setErrore("Scegli il cantiere e il posatore.");
      return;
    }
    setSalvataggio(true);
    setErrore(null);
    const { error } = await supabase.from("assegnazioni").insert({
      cantiere_id: cantiereId,
      posatore_id: posatoreId,
      data_inizio: dataInizio,
      data_fine: dataFine,
    });
    setSalvataggio(false);
    if (error) setErrore(error.message);
    else onSalvato();
  }

  return (
    <Modale titolo="Assegna un cantiere" onChiudi={onChiudi}>
      <form onSubmit={salva}>
        <label className="block text-sm font-medium text-gray-700">
          Cantiere
          <select
            value={cantiereId}
            onChange={(e) => setCantiereId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            <option value="">— scegli —</option>
            {cantieri.map((c) => (
              <option key={c.id} value={c.id}>
                {c.cliente}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block text-sm font-medium text-gray-700">
          Posatore
          <select
            value={posatoreId}
            onChange={(e) => setPosatoreId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            <option value="">— scegli —</option>
            {posatori.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>

        <CampiData
          dataInizio={dataInizio}
          dataFine={dataFine}
          setDataInizio={setDataInizio}
          setDataFine={setDataFine}
        />

        {errore && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {errore}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onChiudi}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={salvataggio}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {salvataggio ? "Salvataggio…" : "Assegna"}
          </button>
        </div>
      </form>
    </Modale>
  );
}

function PannelloFerie({
  posatori,
  onChiudi,
  onSalvato,
}: {
  posatori: Posatore[];
  onChiudi: () => void;
  onSalvato: () => void;
}) {
  const [posatoreId, setPosatoreId] = useState("");
  const [motivo, setMotivo] = useState("Ferie");
  const [dataInizio, setDataInizio] = useState(oggiISO());
  const [dataFine, setDataFine] = useState(oggiISO());
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    if (!posatoreId) {
      setErrore("Scegli il posatore.");
      return;
    }
    setSalvataggio(true);
    setErrore(null);
    const { error } = await supabase.from("indisponibilita").insert({
      posatore_id: posatoreId,
      motivo: motivo.trim() || "Ferie",
      data_inizio: dataInizio,
      data_fine: dataFine,
    });
    setSalvataggio(false);
    if (error) {
      setErrore(
        error.message.includes("indisponibilita") ||
          error.code === "42P01"
          ? "La tabella delle ferie non esiste ancora: esegui il file 02_indisponibilita.sql su Supabase."
          : error.message
      );
      return;
    }
    onSalvato();
  }

  return (
    <Modale titolo="Ferie / lavoro proprio" onChiudi={onChiudi}>
      <form onSubmit={salva}>
        <label className="block text-sm font-medium text-gray-700">
          Posatore
          <select
            value={posatoreId}
            onChange={(e) => setPosatoreId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            <option value="">— scegli —</option>
            {posatori.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block text-sm font-medium text-gray-700">
          Motivo
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            placeholder="Ferie, lavoro proprio…"
          />
        </label>

        <CampiData
          dataInizio={dataInizio}
          dataFine={dataFine}
          setDataInizio={setDataInizio}
          setDataFine={setDataFine}
        />

        {errore && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {errore}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onChiudi}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={salvataggio}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: ROSSO }}
          >
            {salvataggio ? "Salvataggio…" : "Segna indisponibile"}
          </button>
        </div>
      </form>
    </Modale>
  );
}

function DettaglioImpegno({
  impegno,
  posatori,
  utente,
  onChiudi,
  onAggiornato,
  onEliminato,
}: {
  impegno: Impegno;
  posatori: Posatore[];
  utente: string;
  onChiudi: () => void;
  onAggiornato: () => void;
  onEliminato: () => void;
}) {
  const isCantiere = impegno.tipo === "cantiere";
  const tabella = isCantiere ? "assegnazioni" : "indisponibilita";

  const [inizio, setInizio] = useState(impegno.data_inizio);
  const [fine, setFine] = useState(impegno.data_fine);
  const [posatoreId, setPosatoreId] = useState(impegno.posatore_id);
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [eliminazione, setEliminazione] = useState(false);
  const [confermaElimina, setConfermaElimina] = useState(false);

  // Ultimo stato salvato, per calcolare cosa è cambiato (per lo storico).
  const salvati = useRef({
    inizio: impegno.data_inizio,
    fine: impegno.data_fine,
    posatore: impegno.posatore_id,
  });

  async function persist(nInizio: string, nFine: string, nPosatore: string) {
    setBusy(true);
    setErrore(null);
    setMsg(null);

    const patch: Record<string, string> = { data_inizio: nInizio, data_fine: nFine };
    if (isCantiere) patch.posatore_id = nPosatore;

    const { error } = await supabase.from(tabella).update(patch).eq("id", impegno.id);
    if (error) {
      setErrore(error.message);
      setBusy(false);
      return;
    }

    // Storico: registra le modifiche (solo per i cantieri).
    if (isCantiere) {
      const s = salvati.current;
      const righe: Record<string, string | null>[] = [];
      if (nInizio !== s.inizio || nFine !== s.fine) {
        righe.push({
          assegnazione_id: impegno.id,
          utente: utente || null,
          campo_modificato: "date",
          valore_precedente: `${formatData(s.inizio)} → ${formatData(s.fine)}`,
          valore_nuovo: `${formatData(nInizio)} → ${formatData(nFine)}`,
          motivo: motivo.trim() || null,
        });
      }
      if (nPosatore !== s.posatore) {
        righe.push({
          assegnazione_id: impegno.id,
          utente: utente || null,
          campo_modificato: "posatore",
          valore_precedente: posatori.find((p) => p.id === s.posatore)?.nome ?? "—",
          valore_nuovo: posatori.find((p) => p.id === nPosatore)?.nome ?? "—",
          motivo: motivo.trim() || null,
        });
      }
      if (righe.length) await supabase.from("modifiche").insert(righe);
    }

    salvati.current = { inizio: nInizio, fine: nFine, posatore: nPosatore };
    setInizio(nInizio);
    setFine(nFine);
    setPosatoreId(nPosatore);
    setMsg("Spostato ✓");
    setBusy(false);
    onAggiornato();
  }

  function sposta(giorni: number) {
    persist(addGiorni(inizio, giorni), addGiorni(fine, giorni), posatoreId);
  }

  async function elimina() {
    setEliminazione(true);
    const { error } = await supabase.from(tabella).delete().eq("id", impegno.id);
    setEliminazione(false);
    if (error) {
      setErrore(error.message);
      setConfermaElimina(false);
    } else {
      onEliminato();
    }
  }

  const bottoneSposta =
    "rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";

  return (
    <Modale titolo={impegno.etichetta} onChiudi={onChiudi}>
      <p className="-mt-2 mb-3 text-sm text-gray-500">
        {isCantiere ? "Cantiere" : "Ferie / lavoro proprio"} ·{" "}
        {formatData(inizio)} → {formatData(fine)}
      </p>

      {isCantiere && (
        <label className="mb-3 block text-sm font-medium text-gray-700">
          Motivo (facoltativo)
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="es. ritardo consegna materiale"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
          <span className="mt-1 block text-xs font-normal text-gray-400">
            Scrivilo <b>prima</b> di spostare: verrà registrato nello storico.
          </span>
        </label>
      )}

      {/* Spostamento rapido */}
      <div className="rounded-xl bg-gray-50 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Sposta
        </p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          <button disabled={busy} onClick={() => sposta(-7)} className={bottoneSposta}>
            −7g
          </button>
          <button disabled={busy} onClick={() => sposta(-1)} className={bottoneSposta}>
            −1g
          </button>
          <button disabled={busy} onClick={() => sposta(1)} className={bottoneSposta}>
            +1g
          </button>
          <button disabled={busy} onClick={() => sposta(7)} className={bottoneSposta}>
            +7g
          </button>
        </div>
      </div>

      {/* Modifica precisa */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium text-gray-700">
          Dal
          <input
            type="date"
            value={inizio}
            onChange={(e) => {
              setInizio(e.target.value);
              if (fine < e.target.value) setFine(e.target.value);
            }}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Al
          <input
            type="date"
            value={fine}
            min={inizio}
            onChange={(e) => setFine(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
      </div>

      {isCantiere && (
        <label className="mt-3 block text-sm font-medium text-gray-700">
          Assegnato a
          <select
            value={posatoreId}
            onChange={(e) => setPosatoreId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            {posatori.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      {msg && <p className="mt-3 text-sm font-medium text-green-700">{msg}</p>}
      {errore && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errore}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between gap-2">
        {confermaElimina ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Confermi?</span>
            <button
              onClick={elimina}
              disabled={eliminazione}
              className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {eliminazione ? "Rimozione…" : "Sì, rimuovi"}
            </button>
            <button
              onClick={() => setConfermaElimina(false)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfermaElimina(true)}
            className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Rimuovi
          </button>
        )}
        <div className="flex gap-2">
          <button
            onClick={onChiudi}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Chiudi
          </button>
          <button
            onClick={() => persist(inizio, fine, posatoreId)}
            disabled={busy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Salvataggio…" : "Salva"}
          </button>
        </div>
      </div>
    </Modale>
  );
}

function Modale({
  titolo,
  onChiudi,
  children,
}: {
  titolo: string;
  onChiudi: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4"
      onClick={onChiudi}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-semibold text-gray-900">{titolo}</h2>
        {children}
      </div>
    </div>
  );
}
