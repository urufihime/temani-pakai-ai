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

export function daysAgoStr(days, refDateStr) {
  const d = refDateStr ? new Date(refDateStr + "T00:00:00") : new Date();
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

/**
 * Level hasil mentah kuis Neraca Kemandirian (rendah/sedang/tinggi,
 * dari skor 0-21). Dipakai di layar hasil kuis (assessment.html)
 * dan ringkasan di profile.html. BEDA dengan RISK_COPY (4 level)
 * yang dipakai untuk hasil gabungan skor kuis + pola tugas di dashboard.
 */
export const QUIZ_LEVEL_COPY = {
  rendah: {
    label: "Rendah",
    title: "Ketergantunganmu pada AI masih rendah",
    text: "Berdasarkan jawabanmu, kamu masih banyak mengandalkan kemampuanmu sendiri. Hasil akhir di dashboard nanti juga mempertimbangkan pola tugasmu minggu berjalan."
  },
  sedang: {
    label: "Sedang",
    title: "Ketergantunganmu pada AI mulai terlihat",
    text: "Beberapa jawabanmu menunjukkan kecenderungan mengandalkan AI. Hasil akhir di dashboard akan disesuaikan lagi dengan pola tugasmu minggu berjalan."
  },
  tinggi: {
    label: "Tinggi",
    title: "Ketergantunganmu pada AI cukup tinggi",
    text: "Sebagian besar jawabanmu menunjukkan ketergantungan yang cukup besar pada AI. Hasil akhir di dashboard akan disesuaikan lagi dengan pola tugasmu minggu berjalan."
  }
};

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
export function computeCombinedRisk(assessmentScore, tasks, refDateStr) {
  const ref = refDateStr || todayStr();
  const base = assessmentLevelIndex(assessmentScore || 0);
  const cutoffStr = daysAgoStr(6, ref);
  const week = (tasks || []).filter((t) => t.date >= cutoffStr && t.date <= ref);
  const isVeryDependent = (t) => (CATEGORY_META[t.category] ? CATEGORY_META[t.category].value : 0) >= 4;
  const veryCount = week.filter(isVeryDependent).length;
  const ratio = week.length > 0 ? veryCount / week.length : 0;
  const todayVery = (tasks || []).filter((t) => t.date === ref && isVeryDependent(t)).length;

  let add = 0;
  if (ratio > 0.75 || todayVery >= 5) add = 2;
  else if (ratio > 0.5 || todayVery >= 3) add = 1;

  const scoreIdx = Math.min(base + add, 3);
  const levels = ["aman", "waspada", "tinggi", "kritis"];
  const continuous = Math.min(3, scoreIdx + ratio * 0.9);

  return { level: levels[scoreIdx], ratio, veryCount, weekTotal: week.length, todayVery, scoreIdx, continuous };
}

/**
 * 5 skala Neraca Kemandirian untuk tugas baru, diurutkan dari
 * paling mandiri ke paling bergantung pada AI. value 1-5 dipakai
 * mesin risiko (semakin besar = semakin bergantung pada AI).
 */
export const CATEGORY_ORDER = ["sangat_mandiri", "mandiri", "cukup_mandiri", "bergantung", "sangat_bergantung"];

export const CATEGORY_META = {
  sangat_mandiri: {
    short: "Sangat Mandiri",
    desc: "Pengguna mampu menyelesaikan tugas tanpa bergantung pada AI. Jika AI digunakan, fungsinya hanya sebagai alat pelengkap untuk meningkatkan kualitas hasil, bukan sebagai penentu utama isi pekerjaan.",
    value: 1,
    color: "var(--ink-navy)"
  },
  mandiri: {
    short: "Mandiri",
    desc: "Pengguna mengerjakan tugas secara mandiri dan hanya memanfaatkan AI pada bagian-bagian tertentu, seperti verifikasi informasi, penyuntingan bahasa, atau memperoleh alternatif solusi.",
    value: 2,
    color: "var(--moss)"
  },
  cukup_mandiri: {
    short: "Cukup Mandiri",
    desc: "AI digunakan sebagai alat bantu untuk memperoleh ide, klarifikasi, atau referensi. Pengguna tetap berperan aktif dalam menyusun dan mengevaluasi hasil tugas.",
    value: 3,
    color: "var(--gold)"
  },
  bergantung: {
    short: "Bergantung",
    desc: "AI digunakan sebagai sumber utama dalam mengerjakan tugas. Pengguna masih melakukan sedikit penyesuaian, tetapi kontribusi pemikiran pribadi relatif terbatas.",
    value: 4,
    color: "var(--amber)"
  },
  sangat_bergantung: {
    short: "Sangat Bergantung",
    desc: "Hampir seluruh proses pengerjaan tugas bergantung pada AI, mulai dari memahami soal, menyusun jawaban, hingga menyelesaikan tugas, dengan sedikit atau tanpa evaluasi pribadi.",
    value: 5,
    color: "var(--debt-red)"
  }
};

// Alias singkat untuk label badge/ledger di berbagai halaman.
export const CATEGORY_LABEL = Object.fromEntries(
  CATEGORY_ORDER.map((key) => [key, CATEGORY_META[key].short])
);

/**
 * Donut chart proporsi tugas 7 hari terakhir per kategori
 * Neraca Kemandirian, dengan total tugas di tengah donat.
 */
export function buildWeekChartSVG(tasks, refDateStr) {
  const ref = refDateStr || todayStr();
  const cutoffStr = daysAgoStr(6, ref); // 6 hari sebelum ref s/d ref = 7 hari
  const weekTasks = (tasks || []).filter((t) => t.date >= cutoffStr && t.date <= ref);
  const total = weekTasks.length;

  if (total === 0) {
    return `<p class="empty">Belum ada tugas tercatat pada minggu ini.</p>`;
  }

  const counts = {};
  CATEGORY_ORDER.forEach((key) => (counts[key] = weekTasks.filter((t) => t.category === key).length));

  const cx = 100, cy = 100, r = 70, strokeWidth = 28;
  const circumference = 2 * Math.PI * r;
  let offsetAccum = 0;

  const segments = CATEGORY_ORDER.map((key) => {
    const count = counts[key];
    if (count === 0) return "";
    const dash = (count / total) * circumference;
    const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${CATEGORY_META[key].color}" stroke-width="${strokeWidth}" stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}" stroke-dashoffset="${(-offsetAccum).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offsetAccum += dash;
    return seg;
  }).join("");

  return `
    <svg viewBox="0 0 200 200" width="220" height="220" style="display:block;margin:16px auto 0;">
      ${segments}
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-family="Fraunces, serif" font-size="28" font-weight="600" fill="var(--ink-navy)">${total}</text>
      <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="10" fill="#847d63">tugas</text>
    </svg>
    <div class="chart-legend" style="justify-content:center;">
      ${CATEGORY_ORDER.map((key) => `<span><span class="legend-dot" style="background:${CATEGORY_META[key].color};"></span>${CATEGORY_META[key].short} (${counts[key]})</span>`).join("")}
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

/**
 * Donut kecil ringkasan kepatuhan aturan pribadi: berapa hari
 * ditaati vs dilanggar dalam N hari terakhir (gabungan semua aturan).
 */
export function buildRuleComplianceSVG(ruleLogs, days = 7, refDateStr) {
  const ref = refDateStr || todayStr();
  const cutoffStr = daysAgoStr(days - 1, ref);
  const recentLogs = (ruleLogs || []).filter((l) => l.date >= cutoffStr && l.date <= ref);
  const followed = recentLogs.filter((l) => l.followed).length;
  const violated = recentLogs.filter((l) => !l.followed).length;
  const total = followed + violated;

  if (total === 0) {
    return `<p class="empty">Belum ada catatan kepatuhan aturan ${days} hari terakhir. Tandai aturanmu setiap hari supaya muncul di sini.</p>`;
  }

  const pct = Math.round((followed / total) * 100);
  const cx = 60, cy = 60, r = 44, strokeWidth = 18;
  const circumference = 2 * Math.PI * r;
  const followedDash = (followed / total) * circumference;

  return `
    <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;margin-bottom:18px;">
      <svg viewBox="0 0 120 120" width="110" height="110" style="flex-shrink:0;">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--debt-red)" stroke-width="${strokeWidth}"/>
        ${followed > 0 ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--moss)" stroke-width="${strokeWidth}" stroke-dasharray="${followedDash.toFixed(2)} ${(circumference - followedDash).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>` : ""}
        <text x="${cx}" y="${cy + 6}" text-anchor="middle" font-family="Fraunces, serif" font-size="20" font-weight="600" fill="var(--ink-navy)">${pct}%</text>
      </svg>
      <div style="font-size:13px;line-height:1.9;">
        <div><span class="legend-dot" style="background:var(--moss);margin-right:6px;"></span>Ditaati: <strong>${followed}</strong></div>
        <div><span class="legend-dot" style="background:var(--debt-red);margin-right:6px;"></span>Dilanggar: <strong>${violated}</strong></div>
        <div style="color:#847d63;font-size:11.5px;margin-top:2px;">dari ${total} catatan · ${days} hari terakhir</div>
      </div>
    </div>
  `;
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

/* ============================================================
   TARGET SEMESTER — elaborasi 1 target besar jadi target mingguan
   sepanjang durasi pemakaian alat per mata kuliah: 14 pertemuan +
   2 minggu UTS + 2 minggu UAS + 1 minggu evaluasi = 19 minggu.
   Dibandingkan dengan capaian nyata dari data tugas mata kuliah
   terkait, divisualisasikan sebagai diagram garis.
   ============================================================ */

export const SEMESTER_WEEKS = 19;

// Peta 19 minggu: minggu mana pertemuan (P1-P14), mana UTS/UAS/evaluasi.
export const WEEK_TYPES = (() => {
  const arr = [];
  let pNum = 0;
  for (let w = 1; w <= SEMESTER_WEEKS; w++) {
    if (w <= 7) { pNum++; arr.push({ type: "pertemuan", label: `P${pNum}` }); }
    else if (w <= 9) { arr.push({ type: "uts", label: "UTS" }); }
    else if (w <= 16) { pNum++; arr.push({ type: "pertemuan", label: `P${pNum}` }); }
    else if (w <= 18) { arr.push({ type: "uas", label: "UAS" }); }
    else { arr.push({ type: "evaluasi", label: "EV" }); }
  }
  return arr;
})();

// Independensi 1 (paling bergantung) - 5 (paling mandiri); kebalikan dari CATEGORY_META.value
function independenceValue(categoryKey) {
  const meta = CATEGORY_META[categoryKey];
  return meta ? 6 - meta.value : 3;
}

export function buildTargetChartSVG(target, tasks, refDateStr) {
  const ref = refDateStr || todayStr();
  const startVal = independenceValue(target.startCategory);
  const endVal = independenceValue(target.endCategory);
  const startDate = new Date(target.startDate + "T00:00:00");
  const now = new Date(ref + "T00:00:00");
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const tasksUpToRef = (tasks || []).filter((t) => t.date <= ref);

  const weeksElapsed = Math.floor((now - startDate) / msPerWeek) + 1;
  const currentWeek = Math.max(1, Math.min(SEMESTER_WEEKS, weeksElapsed));
  const isFinished = weeksElapsed > SEMESTER_WEEKS;
  const notStarted = weeksElapsed < 1;

  const targetPoints = [];
  for (let i = 0; i < SEMESTER_WEEKS; i++) {
    targetPoints.push(startVal + ((endVal - startVal) * i) / (SEMESTER_WEEKS - 1));
  }

  const manualActuals = target.weeklyActuals || {};
  const actualPoints = [];
  for (let i = 0; i < SEMESTER_WEEKS; i++) {
    const weekNum = i + 1;
    if (manualActuals[weekNum] !== undefined && manualActuals[weekNum] !== null) {
      actualPoints.push(independenceValue(manualActuals[weekNum]));
      continue;
    }
    const weekStartStr = new Date(startDate.getTime() + i * msPerWeek).toISOString().slice(0, 10);
    const weekEndStr = new Date(startDate.getTime() + (i + 1) * msPerWeek).toISOString().slice(0, 10);
    const weekTasks = tasksUpToRef.filter(
      (t) => t.course === target.course && t.date >= weekStartStr && t.date < weekEndStr
    );
    if (weekTasks.length === 0) {
      actualPoints.push(null);
    } else {
      const avg = weekTasks.reduce((sum, t) => sum + independenceValue(t.category), 0) / weekTasks.length;
      actualPoints.push(avg);
    }
  }

  // ---- Render SVG ----
  const padL = 34, padR = 12, padT = 12, padB = 26;
  const chartW = 640, chartH = 170;
  const innerW = chartW - padL - padR, innerH = chartH - padT - padB;
  const step = innerW / (SEMESTER_WEEKS - 1);

  const xFor = (i) => padL + i * step;
  const yFor = (v) => padT + innerH - ((v - 1) / 4) * innerH;

  // Pita area minggu libur (UTS/UAS/evaluasi)
  let bands = "";
  let bi = 0;
  while (bi < SEMESTER_WEEKS) {
    const type = WEEK_TYPES[bi].type;
    if (type === "pertemuan") { bi++; continue; }
    let bj = bi;
    while (bj < SEMESTER_WEEKS && WEEK_TYPES[bj].type === type) bj++;
    const x1 = xFor(bi) - step / 2, x2 = xFor(bj - 1) + step / 2;
    bands += `<rect x="${x1.toFixed(1)}" y="${padT}" width="${(x2 - x1).toFixed(1)}" height="${innerH}" fill="var(--paper-2)"/>`;
    bi = bj;
  }

  // Gridline horizontal per level 1-5 + label kategori (dari bawah=paling bergantung, atas=paling mandiri)
  const levelKeys = [...CATEGORY_ORDER].reverse();
  let gridlines = "";
  for (let lvl = 1; lvl <= 5; lvl++) {
    const y = yFor(lvl);
    gridlines += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${chartW - padR}" y2="${y.toFixed(1)}" stroke="var(--paper-line)" stroke-width="1"/>`;
    gridlines += `<text x="2" y="${(y + 3).toFixed(1)}" font-size="8" font-family="IBM Plex Mono, monospace" fill="#a8a08a">${CATEGORY_META[levelKeys[lvl - 1]].short}</text>`;
  }

  const targetPath = targetPoints.map((v, i) => `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(" ");

  let actualPath = "";
  let actualDots = "";
  let prevPoint = null;
  actualPoints.forEach((v, i) => {
    if (v === null) { prevPoint = null; return; }
    const x = xFor(i), y = yFor(v);
    actualPath += prevPoint ? ` L ${x.toFixed(1)},${y.toFixed(1)}` : `M ${x.toFixed(1)},${y.toFixed(1)}`;
    actualDots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="var(--ink-navy)"/>`;
    prevPoint = { x, y };
  });

  const currentX = xFor(currentWeek - 1);
  const markerLine = !notStarted && !isFinished
    ? `<line x1="${currentX.toFixed(1)}" y1="${padT}" x2="${currentX.toFixed(1)}" y2="${chartH - padB}" stroke="var(--debt-red)" stroke-width="1.5" stroke-dasharray="3 3"/>`
    : "";

  // Label di batas tiap blok (awal pertemuan / UTS / UAS / evaluasi)
  let weekLabels = "";
  let lastType = null;
  for (let w = 1; w <= SEMESTER_WEEKS; w++) {
    const info = WEEK_TYPES[w - 1];
    if (info.type !== lastType) {
      weekLabels += `<text x="${xFor(w - 1).toFixed(1)}" y="${chartH - 8}" font-size="8" font-family="IBM Plex Mono, monospace" fill="#847d63" text-anchor="middle">${info.label}</text>`;
    }
    lastType = info.type;
  }

  let statusText;
  const currentLabel = WEEK_TYPES[currentWeek - 1].label;
  if (notStarted) statusText = `Target dimulai ${target.startDate}.`;
  else if (isFinished) statusText = `Durasi 19 minggu terlampaui — semester untuk mata kuliah ini sudah selesai.`;
  else statusText = `Minggu ke-${currentWeek} dari 19 (${currentLabel}${refDateStr ? `, per ${ref}` : ""}).`;

  return `
    <svg viewBox="0 0 ${chartW} ${chartH}" width="100%" style="max-width:${chartW}px;display:block;">
      ${bands}
      ${gridlines}
      ${markerLine}
      <polyline points="${targetPath}" fill="none" stroke="var(--gold)" stroke-width="2" stroke-dasharray="5 4"/>
      <path d="${actualPath}" fill="none" stroke="var(--ink-navy)" stroke-width="2.5"/>
      ${actualDots}
      ${weekLabels}
    </svg>
    <div class="chart-legend" style="margin-top:4px;">
      <span><span class="legend-dot" style="background:var(--ink-navy);"></span>Capaian nyata</span>
      <span><span class="legend-dot" style="background:var(--gold);"></span>Jalur target</span>
      <span><span class="legend-dot" style="background:var(--paper-2);border:1px solid var(--paper-line);"></span>Minggu libur (UTS/UAS/evaluasi)</span>
    </div>
    <p class="note" style="margin-top:8px;">${statusText} Target akhir: <strong>${CATEGORY_META[target.endCategory].short}</strong> di mata kuliah ${escapeHtml(target.course)}.</p>
  `;
}
