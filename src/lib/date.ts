// Piccole utilità per le date, in formato europeo (gg/mm/aaaa).
// Nel database le date sono salvate come "aaaa-mm-gg" (standard).

// Da "aaaa-mm-gg" a "gg/mm/aaaa" per mostrarle a schermo.
export function formatData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

// Data di oggi in formato "aaaa-mm-gg" (fuso orario locale del PC).
export function oggiISO(): string {
  return dateToIso(new Date());
}

// --- Conversioni tra stringa "aaaa-mm-gg" e oggetto Date (giorno di calendario) ---
export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function dateToIso(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Aggiunge (o toglie, con n negativo) un numero di giorni a una data.
export function addGiorni(iso: string, n: number): string {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + n);
  return dateToIso(d);
}

// Il lunedì della settimana che contiene la data indicata.
export function lunediDellaSettimana(iso: string): string {
  const d = isoToDate(iso);
  const giorno = d.getDay(); // 0 = domenica, 1 = lunedì, ... 6 = sabato
  const scarto = (giorno + 6) % 7; // giorni da togliere per arrivare a lunedì
  d.setDate(d.getDate() - scarto);
  return dateToIso(d);
}

// Numero di giorni tra due date (b - a). Es. stesso giorno = 0.
export function giorniTra(aIso: string, bIso: string): number {
  const a = isoToDate(aIso).getTime();
  const b = isoToDate(bIso).getTime();
  return Math.round((b - a) / 86_400_000);
}

// True se la data cade di sabato o domenica.
export function isWeekend(iso: string): boolean {
  const g = isoToDate(iso).getDay();
  return g === 0 || g === 6;
}

// Etichetta breve del giorno della settimana: L M M G V S D.
const LETTERE_GIORNI = ["D", "L", "M", "M", "G", "V", "S"];
export function letteraGiorno(iso: string): string {
  return LETTERE_GIORNI[isoToDate(iso).getDay()];
}

// Solo il numero del giorno del mese (1..31).
export function numeroGiorno(iso: string): number {
  return isoToDate(iso).getDate();
}
