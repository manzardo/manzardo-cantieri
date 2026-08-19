"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatData, oggiISO, addGiorni, giorniTra } from "@/lib/date";

// Soglia dell'avviso automatico: posa entro N giorni con prerequisiti mancanti (§4.6).
const GIORNI_AVVISO = 20;

type Cantiere = {
  id: string;
  cliente: string;
  riferimento_danea: string | null;
  indirizzo: string | null;
  tipo_lavorazione: string | null;
  note: string | null;
  data_contratto: string | null;
  sopralluogo_fatto: boolean;
  merce_ordinata: boolean;
};

type FormCantiere = {
  cliente: string;
  indirizzo: string;
  tipo_lavorazione: string;
  riferimento_danea: string;
  data_contratto: string;
  note: string;
};

const formVuoto: FormCantiere = {
  cliente: "",
  indirizzo: "",
  tipo_lavorazione: "",
  riferimento_danea: "",
  data_contratto: "",
  note: "",
};

export default function CantieriPage() {
  const [cantieri, setCantieri] = useState<Cantiere[]>([]);
  // Per ogni cantiere con posa imminente: la data della prima posa entro la soglia.
  const [poseImminenti, setPoseImminenti] = useState<Map<string, string>>(new Map());
  const [errore, setErrore] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  const [modifica, setModifica] = useState<"nuovo" | string | null>(null);
  const [form, setForm] = useState<FormCantiere>(formVuoto);
  const [salvataggio, setSalvataggio] = useState(false);
  const [confermaId, setConfermaId] = useState<string | null>(null);

  const oggi = oggiISO();

  async function carica() {
    const limite = addGiorni(oggi, GIORNI_AVVISO);
    const [c, a] = await Promise.all([
      supabase
        .from("cantieri")
        .select(
          "id, cliente, riferimento_danea, indirizzo, tipo_lavorazione, note, data_contratto, sopralluogo_fatto, merce_ordinata"
        )
        .order("data_contratto", { ascending: true, nullsFirst: false }),
      supabase
        .from("assegnazioni")
        .select("cantiere_id, data_inizio")
        .gte("data_inizio", oggi)
        .lte("data_inizio", limite),
    ]);

    if (c.error) setErrore(c.error.message);
    else setCantieri(c.data ?? []);

    // Prima posa (più vicina) entro la soglia, per ciascun cantiere.
    const mappa = new Map<string, string>();
    for (const r of a.data ?? []) {
      const attuale = mappa.get(r.cantiere_id);
      if (!attuale || r.data_inizio < attuale) mappa.set(r.cantiere_id, r.data_inizio);
    }
    setPoseImminenti(mappa);
    setPronto(true);
  }

  useEffect(() => {
    carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calcola l'avviso per un cantiere: posa vicina + prerequisiti mancanti.
  function avviso(c: Cantiere) {
    const posa = poseImminenti.get(c.id);
    if (!posa) return null;
    const mancano: string[] = [];
    if (!c.sopralluogo_fatto) mancano.push("sopralluogo");
    if (!c.merce_ordinata) mancano.push("merce ordinata");
    if (mancano.length === 0) return null;
    return { giorni: giorniTra(oggi, posa), data: posa, mancano };
  }

  const conAvviso = cantieri.filter((c) => avviso(c) !== null);

  function apriNuovo() {
    setForm(formVuoto);
    setModifica("nuovo");
  }

  function apriModifica(c: Cantiere) {
    setForm({
      cliente: c.cliente,
      indirizzo: c.indirizzo ?? "",
      tipo_lavorazione: c.tipo_lavorazione ?? "",
      riferimento_danea: c.riferimento_danea ?? "",
      data_contratto: c.data_contratto ?? "",
      note: c.note ?? "",
    });
    setModifica(c.id);
  }

  function chiudiPannello() {
    setModifica(null);
    setForm(formVuoto);
  }

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente.trim()) return;
    setSalvataggio(true);
    setErrore(null);

    const valori = {
      cliente: form.cliente.trim(),
      indirizzo: form.indirizzo.trim() || null,
      tipo_lavorazione: form.tipo_lavorazione.trim() || null,
      riferimento_danea: form.riferimento_danea.trim() || null,
      data_contratto: form.data_contratto || null,
      note: form.note.trim() || null,
    };

    let error;
    if (modifica === "nuovo") {
      ({ error } = await supabase.from("cantieri").insert(valori));
    } else {
      ({ error } = await supabase.from("cantieri").update(valori).eq("id", modifica));
    }

    setSalvataggio(false);
    if (error) {
      setErrore(error.message);
      return;
    }
    chiudiPannello();
    carica();
  }

  async function toggle(c: Cantiere, campo: "sopralluogo_fatto" | "merce_ordinata") {
    const nuovoValore = !c[campo];
    setCantieri((prec) =>
      prec.map((x) => (x.id === c.id ? { ...x, [campo]: nuovoValore } : x))
    );
    const { error } = await supabase
      .from("cantieri")
      .update({ [campo]: nuovoValore })
      .eq("id", c.id);
    if (error) {
      setErrore(error.message);
      carica();
    }
  }

  async function elimina(c: Cantiere) {
    const { error } = await supabase.from("cantieri").delete().eq("id", c.id);
    setConfermaId(null);
    if (error) setErrore(error.message);
    else carica();
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">
          Cantieri <span className="text-gray-400">({cantieri.length})</span>
        </h1>
        <button
          onClick={apriNuovo}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          + Nuovo cantiere
        </button>
      </div>

      {errore && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errore}
        </p>
      )}

      {/* Riepilogo avvisi (posa entro 20 giorni, prerequisiti mancanti) */}
      {conAvviso.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="font-semibold">⚠ {conAvviso.length}</span>{" "}
          {conAvviso.length === 1
            ? "cantiere ha la posa vicina (entro 20 giorni) ma manca sopralluogo o merce."
            : "cantieri hanno la posa vicina (entro 20 giorni) ma manca sopralluogo o merce."}
        </div>
      )}

      {!pronto ? (
        <p className="mt-4 text-gray-500">Caricamento…</p>
      ) : cantieri.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-gray-200 p-6 text-center text-gray-500">
          Nessun cantiere. Clicca <b>+ Nuovo cantiere</b> per aggiungere il primo.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {cantieri.map((c) => {
            const av = avviso(c);
            return (
              <li
                key={c.id}
                className={
                  "rounded-2xl border bg-white p-4 shadow-sm " +
                  (av ? "border-amber-300 ring-1 ring-amber-200" : "border-gray-100")
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{c.cliente}</p>
                    <p className="text-sm text-gray-500">
                      {[c.tipo_lavorazione, c.indirizzo].filter(Boolean).join(" · ") ||
                        "—"}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      Contratto: {formatData(c.data_contratto)}
                      {c.riferimento_danea ? ` · Danea: ${c.riferimento_danea}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {confermaId === c.id ? (
                      <>
                        <button
                          onClick={() => elimina(c)}
                          className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-red-700"
                        >
                          Sì, elimina
                        </button>
                        <button
                          onClick={() => setConfermaId(null)}
                          className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-700 transition hover:bg-gray-50"
                        >
                          No
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => apriModifica(c)}
                          className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-700 transition hover:bg-gray-50"
                        >
                          Modifica
                        </button>
                        <button
                          onClick={() => setConfermaId(c.id)}
                          className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-red-600 transition hover:bg-red-50"
                        >
                          Elimina
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {av && (
                  <div className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
                    ⚠ Posa il <b>{formatData(av.data)}</b>{" "}
                    {av.giorni === 0
                      ? "(oggi)"
                      : av.giorni === 1
                      ? "(tra 1 giorno)"
                      : `(tra ${av.giorni} giorni)`}{" "}
                    — manca: <b>{av.mancano.join(" e ")}</b>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <ChipPrerequisito
                    attivo={c.sopralluogo_fatto}
                    onClick={() => toggle(c, "sopralluogo_fatto")}
                    label="Sopralluogo"
                  />
                  <ChipPrerequisito
                    attivo={c.merce_ordinata}
                    onClick={() => toggle(c, "merce_ordinata")}
                    label="Merce ordinata"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modifica !== null && (
        <PannelloForm
          titolo={modifica === "nuovo" ? "Nuovo cantiere" : "Modifica cantiere"}
          form={form}
          setForm={setForm}
          onSalva={salva}
          onAnnulla={chiudiPannello}
          salvataggio={salvataggio}
        />
      )}
    </main>
  );
}

function ChipPrerequisito({
  attivo,
  onClick,
  label,
}: {
  attivo: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full px-3 py-1 text-xs font-medium transition " +
        (attivo
          ? "bg-green-100 text-green-800 ring-1 ring-green-300"
          : "bg-gray-100 text-gray-500 ring-1 ring-gray-200 hover:bg-gray-200")
      }
    >
      {attivo ? "✓ " : "○ "}
      {label}
    </button>
  );
}

function PannelloForm({
  titolo,
  form,
  setForm,
  onSalva,
  onAnnulla,
  salvataggio,
}: {
  titolo: string;
  form: FormCantiere;
  setForm: (f: FormCantiere) => void;
  onSalva: (e: React.FormEvent) => void;
  onAnnulla: () => void;
  salvataggio: boolean;
}) {
  const campo = (k: keyof FormCantiere, v: string) => setForm({ ...form, [k]: v });

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={onSalva}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <h2 className="text-base font-semibold text-gray-900">{titolo}</h2>

        <label className="mt-4 block text-sm font-medium text-gray-700">
          Cliente *
          <input
            required
            value={form.cliente}
            onChange={(e) => campo("cliente", e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            placeholder="Es. Rossi Mario"
          />
        </label>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700">
            Tipo lavorazione
            <input
              value={form.tipo_lavorazione}
              onChange={(e) => campo("tipo_lavorazione", e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              placeholder="Es. Posa bagno"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Data contratto
            <input
              type="date"
              value={form.data_contratto}
              onChange={(e) => campo("data_contratto", e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </label>
        </div>

        <label className="mt-3 block text-sm font-medium text-gray-700">
          Indirizzo
          <input
            value={form.indirizzo}
            onChange={(e) => campo("indirizzo", e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            placeholder="Via, numero, città"
          />
        </label>

        <label className="mt-3 block text-sm font-medium text-gray-700">
          Riferimento Danea (opzionale)
          <input
            value={form.riferimento_danea}
            onChange={(e) => campo("riferimento_danea", e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            placeholder="Codice cliente/documento in Danea"
          />
        </label>

        <label className="mt-3 block text-sm font-medium text-gray-700">
          Note
          <textarea
            value={form.note}
            onChange={(e) => campo("note", e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onAnnulla}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={salvataggio}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {salvataggio ? "Salvataggio…" : "Salva"}
          </button>
        </div>
      </form>
    </div>
  );
}
