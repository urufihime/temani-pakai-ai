import { requireAuth, logout } from "./authGuard.js";
import { getUserProfile, getTasks, getJournalEntries } from "./firestore.js";
import {
  escapeHtml,
  RISK_COPY,
  buildGaugeSVG,
  computeCombinedRisk,
  buildWeekChartSVG,
  buildSemanticNetworkSVG,
  CATEGORY_LABEL
} from "./utils.js";

const root = document.getElementById("root");
document.getElementById("logoutBtn").addEventListener("click", logout);

requireAuth(async (user) => {
  const me = await getUserProfile(user.uid);
  document.getElementById("userGreeting").textContent = `${me.name} · ${me.role === "dosen" ? "Dosen" : "Mahasiswa"}`;

  if (me.role !== "dosen") {
    root.innerHTML = `
      <div class="card">
        <p class="empty">Halaman ini khusus untuk dosen.</p>
        <a href="dashboard.html" class="btn btn-primary" style="text-decoration:none;">Ke Dashboard</a>
      </div>
    `;
    return;
  }

  const targetUid = new URLSearchParams(window.location.search).get("uid");
  if (!targetUid) {
    root.innerHTML = `<div class="card"><p class="empty">Mahasiswa tidak ditemukan.</p></div>`;
    return;
  }

  const student = await getUserProfile(targetUid);
  if (!student || student.role !== "mahasiswa" || student.kelas !== me.kelas) {
    root.innerHTML = `
      <div class="card">
        <p class="empty">Kamu tidak punya akses ke profil mahasiswa ini (bukan bagian dari kelasmu).</p>
        <a href="dashboard.html" class="btn btn-primary" style="text-decoration:none;">Kembali ke Dashboard</a>
      </div>
    `;
    return;
  }

  const [tasks, journal] = await Promise.all([getTasks(targetUid), getJournalEntries(targetUid)]);
  render(student, tasks, journal);
});

function render(student, tasks, journal) {
  const riskSection = student.assessmentDone
    ? (() => {
        const risk = computeCombinedRisk(student.assessmentScore, tasks);
        const copy = RISK_COPY[risk.level];
        return `
          <div class="card">
            <div class="card-head"><h2>Peringatan Dini</h2><span class="tag">Gauge ketergantungan</span></div>
            <div class="gauge-wrap">${buildGaugeSVG(risk.continuous / 3)}</div>
            <p class="gauge-level-line">
              Level saat ini: <strong>${risk.level.charAt(0).toUpperCase() + risk.level.slice(1)}</strong> ·
              ${risk.veryCount}/${risk.weekTotal} tugas minggu ini "Sangat Bergantung"
            </p>
            <div class="risk-banner ${risk.level}" style="margin-bottom:0;">
              <p class="risk-banner-label">${copy.label}</p>
              <h3>${copy.title}</h3>
              <p>${copy.text}</p>
              ${copy.impacts.length ? `<ul>${copy.impacts.map((i) => `<li>${i}</li>`).join("")}</ul>` : ""}
              <div class="action-box">${copy.action}</div>
            </div>
          </div>
        `;
      })()
    : `<div class="card"><p class="empty">Mahasiswa ini belum mengisi Neraca Kemandirian.</p></div>`;

  root.innerHTML = `
    <div class="card">
      <p class="eyebrow">Profil Mahasiswa</p>
      <h2 style="font-family:'Fraunces',serif;margin:0 0 4px;">${escapeHtml(student.name)}</h2>
      <p style="color:#5c5847;font-size:13px;margin:0;">${escapeHtml(student.email)} · Kelas ${escapeHtml(student.kelas)}</p>
    </div>

    ${riskSection}

    <div class="card">
      <div class="card-head"><h2>Neraca Minggu Ini</h2><span class="tag">7 hari terakhir</span></div>
      ${buildWeekChartSVG(tasks)}
    </div>

    <div class="card">
      <div class="card-head"><h2>Riwayat Tugas</h2><span class="tag">${tasks.length} total</span></div>
      ${tasks.length === 0
        ? `<p class="empty">Belum ada tugas tercatat.</p>`
        : tasks.map((t) => `
          <div class="ledger-row">
            <span class="ledger-date">${t.date}</span>
            <span>${escapeHtml(t.course)} — ${escapeHtml(t.title)}</span>
            <span class="badge badge-${t.category}">${CATEGORY_LABEL[t.category]}</span>
            <span></span>
          </div>
        `).join("")}
    </div>

    <div class="card">
      <div class="card-head"><h2>Jurnal Refleksi</h2><span class="tag">${journal.length} entri</span></div>
      ${journal.length === 0
        ? `<p class="empty">Belum ada refleksi jurnal.</p>`
        : journal.map((j) => `
          <div class="journal-entry">
            <div class="journal-date">${j.date}</div>
            <div>${escapeHtml(j.text)}</div>
          </div>
        `).join("")}
    </div>

    <div class="card">
      <div class="card-head"><h2>Peta Jaringan Semantik Jurnal</h2><span class="tag">${journal.length} entri dianalisis</span></div>
      ${buildSemanticNetworkSVG(journal)}
    </div>
  `;
}
