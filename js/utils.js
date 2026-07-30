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

/* ============================================================
   ANALISIS JARINGAN SEMANTIK — Jurnal Refleksi
   Mengubah teks jurnal jadi graf kata: node = kata kunci yang
   sering muncul, garis = dua kata yang sering muncul bersamaan
   dalam kalimat yang sama. Layout dihitung pakai simulasi gaya
   sederhana (repulsion + spring) langsung di browser.
   ============================================================ */

const STOPWORDS_ID = new Set([
  "yang","dan","di","ke","dari","ini","itu","saya","aku","kamu","kita","kami","mereka",
  "akan","untuk","dengan","pada","adalah","atau","juga","tidak","ada","karena","jadi",
  "saat","bisa","lebih","masih","sudah","belum","harus","kalau","jika","agar","supaya",
  "seperti","dalam","oleh","sebagai","antara","atas","bawah","sangat","begitu","sekali",
  "hari","ini","itu","tersebut","banyak","sedikit","semua","setiap","tiap","sering",
  "kadang","selalu","pernah","lagi","hanya","cuma","saja","pun","kah","lah","tapi",
  "tetapi","namun","sehingga","ketika","waktu","tugas","kuliah","dosen","kelas","the",
  "and","for","that","this","with","not","have","has","was","were","are","yaitu",
  "merasa","rasanya","cukup","mulai","terus","apa","gimana","bagaimana","nya","ya",
  "aja","gak","nggak","enggak","bikin","buat","dibuat","jadi","udah","udah","udh"
]);

function tokenizeForNetwork(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u00e0-\u024f\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS_ID.has(w));
}

export function buildSemanticNetworkSVG(entries) {
  const texts = (entries || []).map((e) => e.text).filter(Boolean);
  if (texts.length === 0) {
    return `<p class="empty">Belum ada jurnal untuk dianalisis. Tulis beberapa refleksi dulu, ya.</p>`;
  }

  // Frekuensi kata (global) untuk ukuran node
  const freq = {};
  texts.forEach((t) => tokenizeForNetwork(t).forEach((w) => (freq[w] = (freq[w] || 0) + 1)));

  // Co-occurrence per kalimat untuk garis penghubung
  const coOccur = {};
  const bumpEdge = (a, b) => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    coOccur[key] = (coOccur[key] || 0) + 1;
  };
  texts.forEach((t) => {
    t.split(/[.!?\n]+/).forEach((sentence) => {
      const words = [...new Set(tokenizeForNetwork(sentence))].slice(0, 8);
      for (let i = 0; i < words.length; i++) {
        for (let j = i + 1; j < words.length; j++) bumpEdge(words[i], words[j]);
      }
    });
  });

  const topWords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map(([w]) => w);

  if (topWords.length < 2) {
    return `<p class="empty">Belum cukup variasi kata di jurnalmu untuk membentuk peta jaringan. Tulis refleksi yang lebih beragam.</p>`;
  }

  const topSet = new Set(topWords);
  const edges = Object.entries(coOccur)
    .map(([key, weight]) => {
      const [a, b] = key.split("|");
      return { a, b, weight };
    })
    .filter((e) => topSet.has(e.a) && topSet.has(e.b));

  // ---- Simulasi gaya sederhana (repulsion + spring + centering) ----
  const W = 420, H = 320, cx = W / 2, cy = H / 2;
  const nodes = topWords.map((w, i) => ({
    id: w,
    freq: freq[w],
    x: cx + Math.cos((i / topWords.length) * Math.PI * 2) * 100,
    y: cy + Math.sin((i / topWords.length) * Math.PI * 2) * 100,
    vx: 0,
    vy: 0
  }));
  const nodeByWord = Object.fromEntries(nodes.map((n) => [n.id, n]));

  for (let iter = 0; iter < 220; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const n1 = nodes[i], n2 = nodes[j];
        let dx = n1.x - n2.x, dy = n1.y - n2.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const repel = 900 / (dist * dist);
        dx /= dist; dy /= dist;
        n1.vx += dx * repel; n1.vy += dy * repel;
        n2.vx -= dx * repel; n2.vy -= dy * repel;
      }
    }
    edges.forEach((e) => {
      const n1 = nodeByWord[e.a], n2 = nodeByWord[e.b];
      let dx = n2.x - n1.x, dy = n2.y - n1.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const idealLen = 90 / Math.min(e.weight, 4);
      const force = (dist - idealLen) * 0.02;
      dx /= dist; dy /= dist;
      n1.vx += dx * force; n1.vy += dy * force;
      n2.vx -= dx * force; n2.vy -= dy * force;
    });
    nodes.forEach((n) => {
      n.vx += (cx - n.x) * 0.002;
      n.vy += (cy - n.y) * 0.002;
      n.vx *= 0.85; n.vy *= 0.85;
      n.x += n.vx; n.y += n.vy;
      n.x = Math.max(30, Math.min(W - 30, n.x));
      n.y = Math.max(24, Math.min(H - 24, n.y));
    });
  }

  const maxFreq = Math.max(...nodes.map((n) => n.freq));
  const edgeLines = edges.map((e) => {
    const n1 = nodeByWord[e.a], n2 = nodeByWord[e.b];
    const w = Math.min(4, 0.8 + e.weight * 0.6);
    return `<line x1="${n1.x.toFixed(1)}" y1="${n1.y.toFixed(1)}" x2="${n2.x.toFixed(1)}" y2="${n2.y.toFixed(1)}" stroke="var(--paper-line)" stroke-width="${w}" opacity="0.85"/>`;
  }).join("");

  const nodeCircles = nodes.map((n, i) => {
    const r = 8 + (n.freq / maxFreq) * 12;
    const color = i < 3 ? "var(--gold)" : "var(--ink-navy)";
    return `
      <circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" opacity="0.92"/>
      <text x="${n.x.toFixed(1)}" y="${(n.y + r + 12).toFixed(1)}" font-size="11" font-family="Inter, sans-serif" fill="#3c3a32" text-anchor="middle">${escapeHtml(n.id)}</text>
    `;
  }).join("");

  return `
    <svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:520px;display:block;margin:0 auto;">
      ${edgeLines}
      ${nodeCircles}
    </svg>
    <p class="note" style="margin-top:14px;">Ukuran lingkaran = seberapa sering kata itu muncul di jurnalmu. Garis = dua kata yang sering muncul dalam kalimat yang sama. 3 kata terbesar ditandai warna emas.</p>
  `;
}
