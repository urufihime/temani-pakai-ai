import { requireAuth, logout } from "./authGuard.js";
import { getUserProfile, saveAssessmentResult } from "./firestore.js";
import { assessmentLevelIndex, QUIZ_LEVEL_COPY } from "./utils.js";

const root = document.getElementById("root");
document.getElementById("logoutBtn").addEventListener("click", logout);

let CURRENT_USER = null;
let PROFILE = null;
let currentIndex = 0;
let answers = [];

/* ============================================================
   BANK SOAL — 7 pertanyaan. Nilai tiap opsi = indeksnya (0-3),
   sesuai urutan opsi dari yang paling mandiri ke paling
   bergantung pada AI. Skor total 0-21.
   ============================================================ */
const QUESTIONS = [
  {
    q: "Seberapa sering kamu menggunakan AI untuk membuat draf pertama tugas kuliah?",
    options: ["Hampir tidak pernah", "Kadang-kadang", "Sering", "Hampir selalu"]
  },
  {
    q: "Kalau AI tiba-tiba tidak bisa diakses, seberapa yakin kamu bisa menyelesaikan tugas itu sendiri?",
    options: ["Sangat yakin", "Cukup yakin", "Kurang yakin", "Tidak yakin sama sekali"]
  },
  {
    q: "Seberapa sering kamu mengumpulkan tugas tanpa benar-benar memahami isi yang dibuat AI?",
    options: ["Tidak pernah", "Jarang", "Cukup sering", "Sering"]
  },
  {
    q: "Setelah AI memberi jawaban, seberapa besar kamu mengedit ulang atau memverifikasi isinya dengan pemahamanmu sendiri?",
    options: ["Selalu saya tulis ulang dengan pemahaman sendiri", "Saya edit cukup banyak", "Saya edit sedikit", "Saya pakai hampir apa adanya"]
  },
  {
    q: "Apakah kamu merasa cemas atau tidak nyaman saat mengerjakan tugas tanpa membuka AI?",
    options: ["Tidak sama sekali", "Sedikit", "Cukup cemas", "Sangat cemas"]
  },
  {
    q: "Berapa lama rata-rata kamu membuka AI untuk kebutuhan akademik per hari?",
    options: ["Kurang dari 30 menit", "30–60 menit", "1–3 jam", "Lebih dari 3 jam"]
  },
  {
    q: "Dalam sebulan terakhir, seberapa sering kamu mencoba mengerjakan tugas kuliah tanpa bantuan AI sama sekali?",
    options: ["Hampir selalu tanpa AI", "Sering tanpa AI", "Jarang tanpa AI", "Hampir tidak pernah tanpa AI"]
  }
];

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
      ${q.options.map((text, i) => `
        <button type="button" class="quiz-option" data-value="${i}" data-selected="${selected === i}">
          ${text}
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
   SELESAI: hitung skor (0-21), simpan ke Firestore, tampilkan hasil
   ============================================================ */
async function finishQuiz() {
  const nextBtn = document.getElementById("nextBtn");
  nextBtn.disabled = true;
  nextBtn.textContent = "Menyimpan…";

  const score = answers.reduce((a, b) => a + b, 0);
  const idx = assessmentLevelIndex(score);
  const level = ["rendah", "sedang", "tinggi"][idx];

  await saveAssessmentResult(CURRENT_USER.uid, { score, level });
  renderResult(level, score);
}

function renderResult(level, score) {
  const copy = QUIZ_LEVEL_COPY[level];
  root.innerHTML = `
    <div class="result-wrap">
      <div class="result-badge ${level}">${copy.label}</div>
      <h2>${copy.title}</h2>
      <p>${copy.text}</p>
      <p style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:#847d63;margin-bottom:26px;">
        Skor kuis: ${score}/21
      </p>
      <a href="dashboard.html" class="btn btn-primary" style="text-decoration:none;display:inline-block;">Lanjut ke Dashboard</a>
    </div>
  `;
}

/* ============================================================
   Sudah pernah isi asesmen — tampilkan hasil lama + opsi ulang
   ============================================================ */
function renderExistingResult() {
  const copy = QUIZ_LEVEL_COPY[PROFILE.assessmentLevel] || QUIZ_LEVEL_COPY.rendah;
  root.innerHTML = `
    <div class="result-wrap">
      <div class="result-badge ${PROFILE.assessmentLevel}">${copy.label}</div>
      <h2>Kamu sudah pernah mengisi asesmen ini</h2>
      <p>Hasil terakhirmu: <strong>${copy.title}</strong> (skor ${PROFILE.assessmentScore}/21).</p>
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
