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

/**
 * Bangun SVG gauge/meteran setengah lingkaran untuk menampilkan
 * tingkat risiko ketergantungan AI. ratio: 0 (mandiri penuh) - 1 (sangat bergantung).
 */
export function buildGaugeSVG(ratio) {
  const r = ratio == null || isNaN(ratio) ? 0 : Math.max(0, Math.min(1, ratio));
  const thetaDeg = 180 - r * 180;
  const thetaRad = (thetaDeg * Math.PI) / 180;
  const cx = 150, cy = 150, needleLen = 92;
  const nx = (cx + needleLen * Math.cos(thetaRad)).toFixed(1);
  const ny = (cy - needleLen * Math.sin(thetaRad)).toFixed(1);

  return `
    <svg viewBox="0 0 300 178" class="gauge-svg" role="img" aria-label="Meteran tingkat risiko">
      <path d="M 40 150 A 110 110 0 0 1 72.22 72.22" fill="none" stroke="var(--moss)" stroke-width="22" stroke-linecap="round"/>
      <path d="M 72.22 72.22 A 110 110 0 0 1 150 40" fill="none" stroke="var(--gold)" stroke-width="22" stroke-linecap="round"/>
      <path d="M 150 40 A 110 110 0 0 1 227.78 72.22" fill="none" stroke="var(--amber)" stroke-width="22" stroke-linecap="round"/>
      <path d="M 227.78 72.22 A 110 110 0 0 1 260 150" fill="none" stroke="var(--debt-red)" stroke-width="22" stroke-linecap="round"/>
      <line x1="150" y1="150" x2="${nx}" y2="${ny}" stroke="var(--ink-navy)" stroke-width="4" stroke-linecap="round"/>
      <circle cx="150" cy="150" r="9" fill="var(--ink-navy)"/>
    </svg>
  `;
}
