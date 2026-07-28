import { requireAuth, logout } from "./authGuard.js";
import { getUserProfile, saveAssessmentResult } from "./firestore.js";

const root = document.getElementById("root");
document.getElementById("logoutBtn").addEventListener("click", logout);

let CURRENT_USER = null;
let PROFILE = null;
let currentIndex = 0;
let answers = [];

/* ============================================================
   BANK SOAL — 8 pertanyaan, tiap opsi bernilai 1 (mandiri) s/d
   4 (sangat bergantung pada AI). Skor akhir dirata-rata.
   ============================================================ */
const QUESTIONS = [
  {
    q: "Saat menulis draf awal tugas esai/laporan, saya biasanya...",
    options: [
      { text: "Menulis sendiri dari nol", value: 1 },
      { text: "Menulis sendiri, sesekali minta AI mengecek tata bahasa", value: 2 },
      { text: "Minta AI membuat draf, lalu saya edit ulang", value: 3 },
      { text: "Minta AI menulis penuh, saya tinggal kumpulkan", value: 4 }
    ]
  },
  {
    q: "Saat mengerjakan soal hitungan atau logika...",
    options: [
      { text: "Selesaikan sendiri langkah demi langkah", value: 1 },
      { text: "Coba sendiri dulu, baru cek jawaban ke AI kalau ragu", value: 2 },
      { text: "Tanya AI cara mengerjakannya, lalu saya ikuti langkahnya", value: 3 },
      { text: "Minta AI langsung memberi jawaban akhir", value: 4 }
    ]
  },
  {
    q: "Saat mencari referensi atau sumber bacaan...",
    options: [
      { text: "Cari dan baca sendiri dari jurnal/buku", value: 1 },
      { text: "Cari sendiri, pakai AI untuk merangkum", value: 2 },
      { text: "Minta AI mencarikan dan merangkumkan sumbernya", value: 3 },
      { text: "Terima rangkuman dari AI tanpa mengecek sumber aslinya", value: 4 }
    ]
  },
  {
    q: "Saat coding atau debugging program...",
    options: [
      { text: "Debug sendiri dengan membaca pesan error & dokumentasi", value: 1 },
      { text: "Coba sendiri dulu, tanya AI kalau benar-benar buntu", value: 2 },
      { text: "Minta AI mencari letak errornya", value: 3 },
      { text: "Minta AI menuliskan ulang kodenya", value: 4 }
    ]
  },
  {
    q: "Saat merevisi tugas sebelum dikumpulkan...",
    options: [
      { text: "Baca ulang dan edit sendiri", value: 1 },
      { text: "Edit sendiri, minta AI mengecek typo/tata bahasa", value: 2 },
      { text: "Minta AI merapikan gaya bahasa saya", value: 3 },
      { text: "Minta AI menulis ulang seluruh bagian", value: 4 }
    ]
  },
  {
    q: "Saat belajar untuk menghadapi ujian...",
    options: [
      { text: "Membuat rangkuman & latihan soal sendiri", value: 1 },
      { text: "Rangkum sendiri, minta AI buatkan soal latihan tambahan", value: 2 },
      { text: "Minta AI merangkum seluruh materi", value: 3 },
      { text: "Hanya membaca rangkuman AI tanpa belajar dari sumber asli", value: 4 }
    ]
  },
  {
    q: "Saat mencoba memahami konsep yang sulit...",
    options: [
      { text: "Diskusi dengan teman/dosen atau baca ulang materi", value: 1 },
      { text: "Coba pahami sendiri dulu, tanya AI untuk penjelasan tambahan", value: 2 },
      { text: "Langsung tanya AI untuk menjelaskan dari awal", value: 3 },
      { text: "Minta AI merangkum lalu saya hafalkan tanpa benar-benar paham", value: 4 }
    ]
  },
  {
    q: "Saat menyusun kerangka/outline tugas besar...",
    options: [
      { text: "Susun sendiri sesuai pemahaman saya", value: 1 },
      { text: "Susun sendiri, minta AI memberi masukan", value: 2 },
      { text: "Minta AI buatkan kerangkanya, lalu saya sesuaikan", value: 3 },
      { text: "Pakai kerangka dari AI apa adanya", value: 4 }
    ]
  }
];

const RESULT_COPY = {
  aman: {
    label: "Aman",
    title: "Kemandirianmu terjaga",
    text: "Kamu masih mengandalkan kemampuanmu sendiri dalam sebagian besar proses belajar. Pertahankan kebiasaan ini, dan gunakan AI sebagai alat bantu, bukan pengganti."
  },
  waspada: {
    label: "Waspada",
    title: "Mulai perlu diperhatikan",
    text: "Ketergantunganmu pada AI mulai terlihat di beberapa aktivitas akademik. Coba mulai kerjakan bagian awal tugas secara mandiri sebelum meminta bantuan AI."
  },
  tinggi: {
    label: "Risiko Tinggi",
    title: "Ketergantungan mulai menumpuk",
    text: "Sebagian besar proses belajarmu kini bergantung pada AI. Ini berisiko menumpuk menjadi \"utang kognitif\" — coba kurangi bertahap dimulai dari satu aktivitas."
  },
  kritis: {
    label: "Kritis",
    title: "Perlu evaluasi segera",
    text: "Hampir seluruh proses belajarmu diserahkan ke AI. Sebaiknya bicarakan dengan dosen atau mentor akademikmu untuk menyusun strategi belajar yang lebih seimbang."
  }
};

function levelFromAverage(avg) {
  if (avg < 1.75) return "aman";
  if (avg < 2.5) return "waspada";
  if (avg < 3.25) return "tinggi";
  return "kritis";
}

/* ============================================================
   INIT
   ============================================================ */
requireAuth(async (user) => {
  CURRENT_USER = user;
  PROFILE = await getUserProfile(user.uid);

  if (PROFILE.assessmentDone) {
    renderExistingResult();
  } else {
    answers = new Array(QUESTIONS.length).fill(null);
    renderQuestion();
  }
});

/* ============================================================
   TAMPILAN: pertanyaan berjalan
   ============================================================ */
function renderQuestion() {
  const q = QUESTIONS[currentIndex];
  const selected = answers[currentIndex];
  const pct = Math.round((currentIndex / QUESTIONS.length) * 100);

  root.innerHTML = `
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%;"></div></div>
    <p class="progress-label">Pertanyaan ${currentIndex + 1} dari ${QUESTIONS.length}</p>

    <h2 class="quiz-question">${q.q}</h2>

    <div class="quiz-options">
      ${q.options.map((opt, i) => `
        <button type="button" class="quiz-option" data-value="${opt.value}" data-selected="${selected === opt.value}">
          ${opt.text}
        </button>
      `).join("")}
    </div>

    <div class="quiz-nav">
      <button class="btn btn-ghost" id="prevBtn" ${currentIndex === 0 ? "disabled" : ""}>Sebelumnya</button>
      <button class="btn btn-primary" id="nextBtn" ${selected === null ? "disabled" : ""}>
        ${currentIndex === QUESTIONS.length - 1 ? "Lihat Hasil" : "Lanjut"}
      </button>
    </div>
  `;

  root.querySelectorAll(".quiz-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      answers[currentIndex] = Number(btn.dataset.value);
      renderQuestion();
    });
  });

  document.getElementById("prevBtn").addEventListener("click", () => {
    if (currentIndex > 0) {
      currentIndex--;
      renderQuestion();
    }
  });

  document.getElementById("nextBtn").addEventListener("click", async () => {
    if (answers[currentIndex] === null) return;
    if (currentIndex < QUESTIONS.length - 1) {
      currentIndex++;
      renderQuestion();
    } else {
      await finishQuiz();
    }
  });
}

/* ============================================================
   SELESAI: hitung skor, simpan ke Firestore, tampilkan hasil
   ============================================================ */
async function finishQuiz() {
  const nextBtn = document.getElementById("nextBtn");
  nextBtn.disabled = true;
  nextBtn.textContent = "Menyimpan…";

  const sum = answers.reduce((a, b) => a + b, 0);
  const avg = sum / QUESTIONS.length;
  const level = levelFromAverage(avg);
  const score = Math.round(((avg - 1) / 3) * 100); // 0 (mandiri penuh) – 100 (sangat bergantung)

  await saveAssessmentResult(CURRENT_USER.uid, { score, level });
  renderResult(level, score);
}

function renderResult(level, score) {
  const copy = RESULT_COPY[level];
  root.innerHTML = `
    <div class="result-wrap">
      <div class="result-badge ${level}">${copy.label}</div>
      <h2>${copy.title}</h2>
      <p>${copy.text}</p>
      <p style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:#847d63;margin-bottom:26px;">
        Skor ketergantungan: ${score}/100
      </p>
      <a href="dashboard.html" class="btn btn-primary" style="text-decoration:none;display:inline-block;">Lanjut ke Dashboard</a>
    </div>
  `;
}

/* ============================================================
   Sudah pernah isi asesmen — tampilkan hasil lama + opsi ulang
   ============================================================ */
function renderExistingResult() {
  const copy = RESULT_COPY[PROFILE.assessmentLevel] || RESULT_COPY.aman;
  root.innerHTML = `
    <div class="result-wrap">
      <div class="result-badge ${PROFILE.assessmentLevel}">${copy.label}</div>
      <h2>Kamu sudah pernah mengisi asesmen ini</h2>
      <p>Hasil terakhirmu: <strong>${copy.title}</strong> (skor ${PROFILE.assessmentScore}/100).</p>
      <div style="display:flex;gap:10px;justify-content:center;">
        <a href="dashboard.html" class="btn btn-primary" style="text-decoration:none;">Ke Dashboard</a>
        <button class="btn btn-ghost" id="retakeBtn">Isi Ulang</button>
      </div>
    </div>
  `;
  document.getElementById("retakeBtn").addEventListener("click", () => {
    currentIndex = 0;
    answers = new Array(QUESTIONS.length).fill(null);
    renderQuestion();
  });
}
