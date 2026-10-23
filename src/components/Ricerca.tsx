"use client";

// Casella di ricerca riutilizzabile, usata in tutte le pagine con un elenco.
// Differenza dal Ctrl+F del browser: qui l'elenco viene DAVVERO filtrato,
// restano a schermo solo i risultati.

export default function Ricerca({
  valore,
  onCambia,
  placeholder = "Cerca…",
}: {
  valore: string;
  onCambia: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative mt-3">
      <input
        type="text"
        value={valore}
        onChange={(e) => onCambia(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 py-2 pl-3 pr-20 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
      />
      {valore !== "" && (
        <button
          type="button"
          onClick={() => onCambia("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-600 transition hover:bg-gray-50"
        >
          Azzera
        </button>
      )}
    </div>
  );
}

// Vero se TUTTE le parole scritte compaiono in uno dei campi indicati.
// Non distingue maiuscole/minuscole né accenti: "perego" trova "Peregò".
// Con più parole l'ordine non conta: "rossi verona" trova "Rossi · Verona".
export function corrisponde(
  cerca: string,
  ...campi: (string | null | undefined)[]
): boolean {
  const parole = pulisci(cerca).split(" ").filter(Boolean);
  if (parole.length === 0) return true;
  const testo = campi.map((c) => pulisci(c ?? "")).join(" ");
  return parole.every((p) => testo.includes(p));
}

function pulisci(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
