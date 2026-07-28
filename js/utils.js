/* ============================================================
   Fungsi bantuan yang dipakai di beberapa halaman
   (dashboard.js, history.js, profile.js)
   ============================================================ */

export function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgoStr(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Tentukan level risiko dari jumlah tugas & jumlah yang "sangat
 * bergantung AI" dalam satu rentang waktu apa pun.
 */
export function riskLevelFromCounts(total, veryCount) {
  if (total === 0) return "aman";
  const ratio = veryCount / total;
  if (ratio >= 0.6 || veryCount >= 5) return "kritis";
  if (ratio >= 0.4 || veryCount >= 3) return "tinggi";
  if (ratio >= 0.15 || veryCount >= 1) return "waspada";
  return "aman";
}

/**
 * Hitung tingkat risiko ketergantungan AI dari daftar tugas,
 * berdasarkan jendela waktu (default 7 hari terakhir).
 */
export function computeRisk(tasks, days = 7) {
  const cutoffStr = daysAgoStr(days);
  const window = tasks.filter((t) => t.date >= cutoffStr);
  const weekTotal = window.length;
  const veryCount = window.filter((t) => t.category === "sangat").length;
  const ratio = weekTotal ? veryCount / weekTotal : 0;
  return { level: riskLevelFromCounts(weekTotal, veryCount), weekTotal, veryCount, ratio };
}

export const RISK_COPY = {
  aman: { label: "Aman", title: "Kemandirianmu terjaga", text: "Sebagian besar tugas kamu kerjakan sendiri. Pertahankan." },
  waspada: { label: "Waspada", title: "Mulai perlu diperhatikan", text: "Ada beberapa tugas yang sangat bergantung pada AI. Coba kurangi sedikit demi sedikit." },
  tinggi: { label: "Risiko Tinggi", title: "Ketergantungan mulai menumpuk", text: "Cukup banyak tugas dikerjakan sangat bergantung pada AI. Waspadai \"utang kognitif\" yang menumpuk." },
  kritis: { label: "Kritis", title: "Perlu evaluasi segera", text: "Sebagian besar tugasmu sangat bergantung pada AI. Coba evaluasi ulang cara belajarmu." }
};

export const CATEGORY_LABEL = {
  mandiri: "Mandiri",
  sebagian: "Sebagian",
  sangat: "Sangat AI"
};
