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
  aman: {
    label: "Status: Aman",
    title: "Pola penggunaan AI-mu masih sehat",
    text: "Belum ada tanda ketergantungan berlebih minggu ini. Terus jaga kebiasaan mengerjakan sebagian besar tugas secara mandiri.",
    impacts: [],
    action: "Tidak ada tindakan mendesak — pertahankan proporsi tugas mandiri yang sudah baik."
  },
  waspada: {
    label: "Peringatan Dini: Waspada",
    title: "Mulai ada kecenderungan mengandalkan AI",
    text: "Beberapa tugas terakhir dikerjakan dengan bantuan AI yang cukup besar. Ini belum berbahaya, tapi pola ini bisa berkembang jika dibiarkan.",
    impacts: [
      "Otak mulai terbiasa \"melempar\" langkah berpikir awal ke AI, sehingga proses menyusun ide sendiri jadi jarang dilatih.",
      "Ini adalah tahap awal dari cognitive debt — semacam utang kognitif yang muncul ketika proses berpikir didelegasikan terus-menerus alih-alih dilatih."
    ],
    action: "Coba kerjakan draf berikutnya tanpa AI dulu, baru gunakan AI untuk mengecek atau menyempurnakan di akhir."
  },
  tinggi: {
    label: "Peringatan Dini: Tinggi",
    title: "Ketergantungan pada AI meningkat nyata",
    text: "Sebagian besar tugasmu minggu ini sangat bergantung pada AI. Pada titik ini, dampaknya mulai terasa pada kemampuan berpikir mandiri.",
    impacts: [
      "Kemampuan berpikir kritis dan memecahkan masalah cenderung menurun karena jarang dilatih tanpa bantuan.",
      "Cognitive debt menumpuk — semakin banyak proses berpikir yang \"dipinjam\" dari AI, semakin sulit menariknya kembali saat dibutuhkan (mis. saat ujian).",
      "Retensi memori terhadap materi yang dikerjakan bisa melemah karena otak tidak benar-benar memproses informasinya sendiri."
    ],
    action: "Pilih satu tugas kecil minggu ini untuk dikerjakan 100% mandiri, lalu bandingkan hasilnya dengan biasanya. Pertimbangkan mendiskusikan pola ini dengan dosen atau tutor."
  },
  kritis: {
    label: "Peringatan Dini: Kritis",
    title: "Tanda ketergantungan berat pada AI",
    text: "Pola penggunaan AI-mu sudah berada di level yang berisiko tinggi terhadap kemandirian akademik.",
    impacts: [
      "Cognitive debt pada level ini bisa membuat kemampuan bernalar mandiri terasa \"tumpul\" ketika AI tidak tersedia, misalnya saat ujian tulis atau presentasi langsung.",
      "Kepercayaan diri akademik menurun karena terbiasa merasa \"tidak mampu\" tanpa bantuan AI.",
      "Pemahaman konsep jangka panjang berisiko dangkal, karena materi lebih banyak diproses oleh AI daripada oleh dirimu sendiri."
    ],
    action: "Ini saat yang tepat untuk berhenti sejenak dan mengevaluasi kebiasaanmu. Pertimbangkan berkonsultasi dengan dosen pembimbing akademik atau layanan konseling kampus untuk menyusun strategi belajar ulang."
  }
};

/**
 * Level dasar dari skor kuis mentah (0-21, 7 pertanyaan x nilai 0-3).
 */
export function assessmentLevelIndex(score) {
  if (score <= 7) return 0; // rendah
  if (score <= 14) return 1; // sedang
  return 2; // tinggi
}

/**
 * Mesin penilaian gabungan: skor kuis (Neraca Kemandirian) digabung
 * dengan pola tugas 7 hari terakhir untuk menghasilkan level akhir
 * (aman/waspada/tinggi/kritis) yang ditampilkan di gauge dashboard.
 */
export function computeCombinedRisk(assessmentScore, tasks) {
  const base = assessmentLevelIndex(assessmentScore || 0);
  const cutoffStr = daysAgoStr(7);
  const week = (tasks || []).filter((t) => t.date >= cutoffStr);
  const veryCount = week.filter((t) => t.category === "sangat").length;
  const ratio = week.length > 0 ? veryCount / week.length : 0;
  const today = todayStr();
  const todayVery = (tasks || []).filter((t) => t.date === today && t.category === "sangat").length;

  let add = 0;
  if (ratio > 0.75 || todayVery >= 5) add = 2;
  else if (ratio > 0.5 || todayVery >= 3) add = 1;

  const scoreIdx = Math.min(base + add, 3);
  const levels = ["aman", "waspada", "tinggi", "kritis"];
  const continuous = Math.min(3, scoreIdx + ratio * 0.9);

  return { level: levels[scoreIdx], ratio, veryCount, weekTotal: week.length, todayVery, scoreIdx, continuous };
}

export const CATEGORY_LABEL = {
  mandiri: "Mandiri",
  sebagian: "Sebagian",
  sangat: "Sangat AI"
};

/**
 * Grafik batang bertumpuk (stacked bar) 7 hari terakhir,
 * menunjukkan jumlah tugas per kategori tiap hari.
 */
export function buildWeekChartSVG(tasks) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const counts = days.map((day) => {
    const dayTasks = tasks.filter((t) => t.date === day);
    return {
      mandiri: dayTasks.filter((t) => t.category === "mandiri").length,
      sebagian: dayTasks.filter((t) => t.category === "sebagian").length,
      sangat: dayTasks.filter((t) => t.category === "sangat").length
    };
  });
  const maxV = Math.max(1, ...counts.map((c) => c.mandiri + c.sebagian + c.sangat));
  const barW = 34, gap = 14, chartH = 110;
  const svgW = days.length * (barW + gap);
  let bars = "";
  counts.forEach((c, i) => {
    const x = i * (barW + gap);
    let y = chartH;
    const segs = [
      ["mandiri", c.mandiri, "var(--moss)"],
      ["sebagian", c.sebagian, "var(--amber)"],
      ["sangat", c.sangat, "var(--debt-red)"]
    ];
    segs.forEach(([, val, color]) => {
      const h = (val / maxV) * chartH;
      y -= h;
      if (val > 0) bars += `<rect x="${x}" y="${y.toFixed(1)}" width="${barW}" height="${h.toFixed(1)}" fill="${color}" rx="1.5"/>`;
    });
    const label = days[i].slice(5).replace("-", "/");
    bars += `<text x="${x + barW / 2}" y="${chartH + 16}" font-size="9.5" font-family="IBM Plex Mono, monospace" fill="#847d63" text-anchor="middle">${label}</text>`;
  });

  return `
    <svg viewBox="0 0 ${svgW} ${chartH + 26}" width="100%" style="max-width:${svgW}px;margin-top:16px;">
      ${bars}
    </svg>
    <div class="chart-legend">
      <span><span class="legend-dot" style="background:var(--moss);"></span>Mandiri</span>
      <span><span class="legend-dot" style="background:var(--amber);"></span>Dibantu Sebagian</span>
      <span><span class="legend-dot" style="background:var(--debt-red);"></span>Sangat Bergantung</span>
    </div>
  `;
}

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
      <text x="14" y="172" font-size="12" font-family="IBM Plex Mono, monospace" fill="#847d63">Aman</text>
      <text x="228" y="172" font-size="12" font-family="IBM Plex Mono, monospace" fill="#847d63">Kritis</text>
    </svg>
  `;
}
