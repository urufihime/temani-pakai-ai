import { requireAuth, logout } from "./authGuard.js";
import {
  getUserProfile,
  updateUserKelas,
  getTasks,
  addTask,
  deleteTask,
  getRules,
  addRule,
  deleteRule,
  logRule,
  getRuleLogs,
  getJournalEntries,
  addJournalEntry,
  getStudentsByKelas,
  getRecentTasks,
  listenUnreadConversations
} from "./firestore.js";
import { escapeHtml, todayStr, RISK_COPY, buildGaugeSVG, computeCombinedRisk, buildWeekChartSVG, buildSemanticNetworkSVG, CATEGORY_ORDER, CATEGORY_META, CATEGORY_LABEL } from "./utils.js";

const root = document.getElementById("root");
const mastheadTitle = document.getElementById("mastheadTitle");
const userGreeting = document.getElementById("userGreeting");
document.getElementById("logoutBtn").addEventListener("click", logout);

let CURRENT_USER = null;
let PROFILE = null;

// data mahasiswa
let TASKS = [];
let RULES = [];
let RULE_LOGS = [];
let JOURNAL = [];
let taskDraft = { course: "", title: "", category: "cukup_mandiri" };
let ruleDraft = "";
let journalDraft = "";

// data dosen
let CLASS_STUDENTS = [];
let STUDENT_TASKS = {};
let SELECTED_STUDENT_UID = null;

// notifikasi chat
let unreadChatCount = 0;

function attachChatBadge() {
  const link = document.getElementById("chatNavLink");
  if (!link) return;
  const existing = link.querySelector(".chat-badge");
  if (existing) existing.remove();
  if (unreadChatCount > 0) {
    const badge = document.createElement("span");
    badge.className = "chat-badge";
    badge.textContent = unreadChatCount > 9 ? "9+" : String(unreadChatCount);
    link.appendChild(badge);
  }
}

/* ============================================================
   INIT & ROUTING
   ============================================================ */
requireAuth(async (user) => {
  CURRENT_USER = user;
  PROFILE = await getUserProfile(user.uid);

  if (!PROFILE) {
    root.innerHTML = `<p class="empty">Profil tidak ditemukan. Coba masuk ulang.</p>`;
    return;
  }

  userGreeting.textContent = `${PROFILE.name} · ${PROFILE.role === "dosen" ? "Dosen" : "Mahasiswa"}`;

  listenUnreadConversations(user.uid, (count) => {
    unreadChatCount = count;
    attachChatBadge();
  });

  await route();
});

async function route() {
  if (!PROFILE.kelas) {
    renderKelasSetup();
    return;
  }
  if (PROFILE.role === "mahasiswa") {
    if (!PROFILE.assessmentDone) {
      renderAssessmentPrompt();
      return;
    }
    mastheadTitle.textContent = "Dashboard Mahasiswa";
    await loadMahasiswaData();
    renderMahasiswaDashboard();
  } else {
    mastheadTitle.textContent = "Dashboard Dosen";
    await loadDosenData();
    renderDosenDashboard();
  }
}

/* ============================================================
   SETUP KODE KELAS (langkah pertama setelah daftar)
   ============================================================ */
function renderKelasSetup() {
  const isDosen = PROFILE.role === "dosen";
  mastheadTitle.textContent = "Satu langkah lagi";
  root.innerHTML = `
    <div class="setup-wrap">
      <div class="card">
        <div class="card-head"><h2>${isDosen ? "Kelas yang kamu ampu" : "Kode kelasmu"}</h2></div>
        <p class="helptext" style="margin-top:0;">
          ${isDosen
            ? "Masukkan nama/kode kelas yang kamu ampu. Mahasiswa yang mendaftar dengan kode yang sama akan muncul di dashboard-mu."
            : "Masukkan kode kelas yang diberikan dosenmu, supaya perkembanganmu bisa dipantau."}
        </p>
        <label for="kelasInput">${isDosen ? "Kode Kelas" : "Kode Kelas"}</label>
        <input type="text" id="kelasInput" placeholder="Contoh: RPL-A-2026">
        <button class="btn btn-primary" id="saveKelasBtn" style="width:100%;">Simpan &amp; Lanjut</button>
      </div>
    </div>
  `;
  document.getElementById("saveKelasBtn").addEventListener("click", async () => {
    const val = document.getElementById("kelasInput").value.trim();
    if (!val) {
      alert("Kode kelas tidak boleh kosong.");
      return;
    }
    const btn = document.getElementById("saveKelasBtn");
    btn.disabled = true;
    btn.textContent = "Menyimpan…";
    await updateUserKelas(CURRENT_USER.uid, val);
    PROFILE.kelas = val;
    await route();
  });
}

/* ============================================================
   PROMPT ASESMEN BELUM DIISI (mahasiswa)
   ============================================================ */
function renderAssessmentPrompt() {
  mastheadTitle.textContent = "Dashboard Mahasiswa";
  root.innerHTML = `
    <div class="setup-wrap">
      <div class="card">
        <div class="card-head"><h2>Isi Neraca Kemandirian dulu, yuk</h2></div>
        <p style="margin:0 0 20px;color:#3c3a32;font-size:14px;line-height:1.6;">
          Sebelum melihat dashboard, kamu perlu mengisi asesmen singkat "Neraca Kemandirian" supaya kami tahu titik awalmu.
        </p>
        <a href="assessment.html" class="btn btn-primary" style="display:inline-block;text-decoration:none;">Isi Assessment</a>
      </div>
    </div>
  `;
}

/* ============================================================
   MAHASISWA — muat data
   ============================================================ */
async function loadMahasiswaData() {
  [TASKS, RULES, RULE_LOGS, JOURNAL] = await Promise.all([
    getTasks(CURRENT_USER.uid),
    getRules(CURRENT_USER.uid),
    getRuleLogs(CURRENT_USER.uid),
    getJournalEntries(CURRENT_USER.uid)
  ]);
}

function renderMahasiswaDashboard() {
  const risk = computeCombinedRisk(PROFILE.assessmentScore, TASKS);
  const copy = RISK_COPY[risk.level];

  root.innerHTML = `
    <div class="dash-shortcuts">
      <a href="chat.html" id="chatNavLink" class="btn btn-ghost btn-small" style="text-decoration:none;">Chat</a>
      <a href="history.html" class="btn btn-ghost btn-small" style="text-decoration:none;">Riwayat</a>
      <a href="profile.html" class="btn btn-ghost btn-small" style="text-decoration:none;">Profil</a>
    </div>

    <div class="card">
      <div class="card-head"><h2>Peringatan Dini</h2><span class="tag">Gauge ketergantungan</span></div>
      <div class="gauge-wrap">${buildGaugeSVG(risk.continuous / 3)}</div>
      <p class="gauge-level-line">Level saat ini: <strong>${copy.label.replace(/^.*: /, "") || copy.label}</strong> · ${risk.veryCount}/${risk.weekTotal} tugas minggu ini "Sangat Bergantung"</p>
      <div class="risk-banner ${risk.level}">
        <p class="risk-banner-label">${copy.label}</p>
        <h3>${copy.title}</h3>
        <p>${copy.text}</p>
        ${copy.impacts && copy.impacts.length ? `<ul>${copy.impacts.map((i) => `<li>${i}</li>`).join("")}</ul>` : ""}
        <div class="action-box">${copy.action}</div>
      </div>
      <a href="assessment.html" class="btn btn-ghost btn-small" style="text-decoration:none;display:inline-block;margin-top:14px;">Isi Ulang Asesmen</a>
    </div>

    <div class="card">
      <div class="card-head"><h2>Neraca Minggu Ini</h2><span class="tag">7 hari terakhir</span></div>
      ${buildWeekChartSVG(TASKS)}
    </div>

    <div class="card">
      <div class="card-head"><h2>Catat Tugas Baru</h2></div>
      <div class="field-row">
        <div>
          <label for="taskCourse">Mata Kuliah</label>
          <input type="text" id="taskCourse" placeholder="Contoh: Basis Data" value="${escapeHtml(taskDraft.course)}">
        </div>
        <div>
          <label for="taskTitle">Judul Tugas</label>
          <input type="text" id="taskTitle" placeholder="Contoh: Laporan ERD" value="${escapeHtml(taskDraft.title)}">
        </div>
      </div>
      <label>Neraca Kemandirian tugas ini</label>
      <div class="pillset" id="taskCatPillset">
        ${CATEGORY_ORDER.map((key) => `
          <button type="button" class="pill" data-cat="${key}" data-active="${taskDraft.category === key}">${CATEGORY_META[key].short}</button>
        `).join("")}
      </div>
      <p class="helptext">${CATEGORY_META[taskDraft.category].desc}</p>
      <button class="btn btn-primary" id="addTaskBtn">Simpan Tugas</button>
    </div>

    <div class="card">
      <div class="card-head"><h2>Riwayat Tugas</h2><span class="tag">${TASKS.length} total</span></div>
      ${TASKS.length === 0
        ? `<p class="empty">Belum ada tugas dicatat.</p>`
        : TASKS.map((t) => `
          <div class="ledger-row">
            <span class="ledger-date">${t.date}</span>
            <span>${escapeHtml(t.course)} — ${escapeHtml(t.title)}</span>
            <span class="badge badge-${t.category}">${CATEGORY_LABEL[t.category] || t.category}</span>
            <button class="ledger-delete" data-id="${t.id}" title="Hapus">✕</button>
          </div>
        `).join("")}
    </div>

    <div class="card">
      <div class="card-head"><h2>Aturan Pribadi</h2></div>
      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <input type="text" id="ruleInput" placeholder="Contoh: Tidak pakai AI untuk draf pertama" value="${escapeHtml(ruleDraft)}" style="margin-bottom:0;flex:1;">
        <button class="btn btn-primary btn-small" id="addRuleBtn">Tambah</button>
      </div>
      ${RULES.length === 0
        ? `<p class="empty">Belum ada aturan. Tambahkan aturan pribadimu di atas.</p>`
        : RULES.map((r) => {
            const log = RULE_LOGS.find((l) => l.ruleId === r.id && l.date === todayStr());
            return `
            <div class="rule-row">
              <span class="rule-text">${escapeHtml(r.text)}</span>
              <div class="rule-actions">
                <button class="chip ${log && log.followed ? "on-ok" : ""}" data-rule="${r.id}" data-followed="true">✓ Ditaati</button>
                <button class="chip ${log && !log.followed ? "on-break" : ""}" data-rule="${r.id}" data-followed="false">✕ Dilanggar</button>
                <button class="ledger-delete" data-delrule="${r.id}" title="Hapus aturan">✕</button>
              </div>
            </div>`;
          }).join("")}
      <p class="note">Tandai setiap hari apakah kamu menaati aturanmu sendiri.</p>
    </div>

    <div class="card">
      <div class="card-head"><h2>Jurnal Refleksi</h2></div>
      <textarea id="journalInput" placeholder="Tulis refleksi singkat tentang penggunaan AI-mu hari ini…">${escapeHtml(journalDraft)}</textarea>
      <button class="btn btn-primary btn-small" id="addJournalBtn">Simpan Refleksi</button>
      ${JOURNAL.length > 0 ? `
        <div style="margin-top:18px;">
          ${JOURNAL.slice(0, 5).map((j) => `
            <div class="journal-entry">
              <div class="journal-date">${j.date}</div>
              <div>${escapeHtml(j.text)}</div>
            </div>
          `).join("")}
        </div>` : ""}
    </div>

    <div class="card">
      <div class="card-head"><h2>Peta Jaringan Semantik Jurnal</h2><span class="tag">${JOURNAL.length} entri dianalisis</span></div>
      ${buildSemanticNetworkSVG(JOURNAL)}
    </div>
  `;

  bindMahasiswaEvents();
  attachChatBadge();
}

function bindMahasiswaEvents() {
  document.getElementById("taskCourse").addEventListener("input", (e) => (taskDraft.course = e.target.value));
  document.getElementById("taskTitle").addEventListener("input", (e) => (taskDraft.title = e.target.value));

  document.getElementById("taskCatPillset").addEventListener("click", (e) => {
    const pill = e.target.closest(".pill");
    if (!pill) return;
    taskDraft.category = pill.dataset.cat;
    renderMahasiswaDashboard();
  });

  document.getElementById("addTaskBtn").addEventListener("click", async () => {
    if (!taskDraft.course.trim() || !taskDraft.title.trim()) {
      alert("Isi mata kuliah dan judul tugas dulu.");
      return;
    }
    await addTask(CURRENT_USER.uid, { ...taskDraft });
    taskDraft = { course: "", title: "", category: "cukup_mandiri" };
    TASKS = await getTasks(CURRENT_USER.uid);
    renderMahasiswaDashboard();
  });

  root.querySelectorAll(".ledger-delete[data-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await deleteTask(CURRENT_USER.uid, btn.dataset.id);
      TASKS = await getTasks(CURRENT_USER.uid);
      renderMahasiswaDashboard();
    });
  });

  document.getElementById("ruleInput").addEventListener("input", (e) => (ruleDraft = e.target.value));
  document.getElementById("addRuleBtn").addEventListener("click", async () => {
    if (!ruleDraft.trim()) return;
    await addRule(CURRENT_USER.uid, ruleDraft.trim());
    ruleDraft = "";
    RULES = await getRules(CURRENT_USER.uid);
    renderMahasiswaDashboard();
  });

  root.querySelectorAll("[data-rule]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await logRule(CURRENT_USER.uid, btn.dataset.rule, btn.dataset.followed === "true");
      RULE_LOGS = await getRuleLogs(CURRENT_USER.uid);
      renderMahasiswaDashboard();
    });
  });

  root.querySelectorAll("[data-delrule]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await deleteRule(CURRENT_USER.uid, btn.dataset.delrule);
      RULES = await getRules(CURRENT_USER.uid);
      RULE_LOGS = await getRuleLogs(CURRENT_USER.uid);
      renderMahasiswaDashboard();
    });
  });

  document.getElementById("journalInput").addEventListener("input", (e) => (journalDraft = e.target.value));
  document.getElementById("addJournalBtn").addEventListener("click", async () => {
    if (!journalDraft.trim()) return;
    await addJournalEntry(CURRENT_USER.uid, journalDraft.trim());
    journalDraft = "";
    JOURNAL = await getJournalEntries(CURRENT_USER.uid);
    renderMahasiswaDashboard();
  });
}

/* ============================================================
   DOSEN — muat data kelas
   ============================================================ */
async function loadDosenData() {
  CLASS_STUDENTS = await getStudentsByKelas(PROFILE.kelas);
  const taskLists = await Promise.all(CLASS_STUDENTS.map((s) => getRecentTasks(s.uid)));
  STUDENT_TASKS = {};
  CLASS_STUDENTS.forEach((s, i) => (STUDENT_TASKS[s.uid] = taskLists[i]));
}

function renderDosenDashboard() {
  const withRisk = CLASS_STUDENTS.map((s) => ({
    ...s,
    risk: s.assessmentDone ? computeCombinedRisk(s.assessmentScore, STUDENT_TASKS[s.uid] || []) : null
  })).sort((a, b) => {
    const order = { kritis: 0, tinggi: 1, waspada: 2, aman: 3 };
    const oa = a.risk ? order[a.risk.level] : 4;
    const ob = b.risk ? order[b.risk.level] : 4;
    return oa - ob;
  });

  const count = { aman: 0, waspada: 0, tinggi: 0, kritis: 0, belum: 0 };
  withRisk.forEach((s) => (s.risk ? count[s.risk.level]++ : count.belum++));

  root.innerHTML = `
    <div class="dash-shortcuts">
      <a href="chat.html" id="chatNavLink" class="btn btn-ghost btn-small" style="text-decoration:none;">Chat</a>
    </div>

    <div class="card-head" style="border-bottom:none;margin-bottom:14px;">
      <h2>Kelas: ${escapeHtml(PROFILE.kelas)}</h2>
      <span class="tag">${withRisk.length} mahasiswa</span>
    </div>

    <div class="stat-row">
      <div class="stat-box"><div class="n">${count.aman}</div><div class="l">Aman</div></div>
      <div class="stat-box"><div class="n">${count.waspada}</div><div class="l">Waspada</div></div>
      <div class="stat-box"><div class="n">${count.tinggi}</div><div class="l">Tinggi</div></div>
      <div class="stat-box"><div class="n">${count.kritis}</div><div class="l">Kritis</div></div>
      <div class="stat-box"><div class="n">${count.belum}</div><div class="l">Belum Isi</div></div>
    </div>

    <div class="card">
      ${withRisk.length === 0 ? `
        <p class="empty">Belum ada mahasiswa yang mendaftar dengan kode kelas ini.</p>
      ` : `
        <table class="class-table">
          <thead><tr><th>Nama</th><th>Status Asesmen</th><th>Neraca Kemandirian</th></tr></thead>
          <tbody>
            ${withRisk.map((s) => `
              <tr data-uid="${s.uid}">
                <td>${escapeHtml(s.name)}</td>
                <td>${s.assessmentDone ? "Sudah mengisi" : "Belum mengisi"}</td>
                <td>${s.risk
                  ? `<span class="risk-dot ${s.risk.level}"></span>${RISK_COPY[s.risk.level].label}`
                  : `<span style="color:#9a927a;">—</span>`}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `}
    </div>

    <div id="modalHost"></div>
  `;

  root.querySelectorAll("tr[data-uid]").forEach((row) => {
    row.addEventListener("click", () => openStudentModal(row.dataset.uid, withRisk));
  });
  attachChatBadge();
}

function openStudentModal(uid, withRisk) {
  const s = withRisk.find((x) => x.uid === uid);
  if (!s) return;
  const tasks = STUDENT_TASKS[uid] || [];

  const banner = s.risk
    ? `
      <div class="gauge-wrap">${buildGaugeSVG(s.risk.continuous / 3)}</div>
      <p class="gauge-level-line">Level saat ini: <strong>${RISK_COPY[s.risk.level].label.replace(/^.*: /, "")}</strong> · ${s.risk.veryCount}/${s.risk.weekTotal} tugas minggu ini "Sangat Bergantung"</p>
      <div class="risk-banner ${s.risk.level}" style="margin-bottom:18px;">
        <p class="risk-banner-label">${RISK_COPY[s.risk.level].label}</p>
        <h3 style="font-size:17px;">${RISK_COPY[s.risk.level].title}</h3>
        <p>${RISK_COPY[s.risk.level].text}</p>
        ${RISK_COPY[s.risk.level].impacts && RISK_COPY[s.risk.level].impacts.length ? `<ul>${RISK_COPY[s.risk.level].impacts.map((i) => `<li>${i}</li>`).join("")}</ul>` : ""}
        <div class="action-box">${RISK_COPY[s.risk.level].action}</div>
      </div>
    `
    : `<div class="card" style="margin-bottom:18px;"><p class="empty">Mahasiswa ini belum mengisi Neraca Kemandirian.</p></div>`;

  document.getElementById("modalHost").innerHTML = `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal">
        <button class="modal-close" id="modalCloseBtn">✕</button>
        <p class="eyebrow">Detail Mahasiswa</p>
        <h2 style="font-family:'Fraunces',serif;margin:0 0 4px;">${escapeHtml(s.name)}</h2>
        <p style="color:#5c5847;font-size:13px;margin:0 0 18px;">${escapeHtml(s.email)}</p>

        ${banner}

        <h3 style="font-size:14px;margin:0 0 10px;">Tugas 7 Hari Terakhir</h3>
        ${tasks.length === 0 ? `<p class="empty">Belum ada tugas tercatat.</p>` : tasks.map((t) => `
          <div class="ledger-row">
            <span class="ledger-date">${t.date}</span>
            <span>${escapeHtml(t.course)} — ${escapeHtml(t.title)}</span>
            <span class="badge badge-${t.category}">${CATEGORY_LABEL[t.category] || t.category}</span>
            <span></span>
          </div>
        `).join("")}

        <a href="student-profile.html?uid=${s.uid}" class="btn btn-primary" style="text-decoration:none;display:inline-block;margin-top:20px;">Lihat Profil Lengkap →</a>
      </div>
    </div>
  `;

  document.getElementById("modalCloseBtn").addEventListener("click", closeStudentModal);
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") closeStudentModal();
  });
}

function closeStudentModal() {
  const host = document.getElementById("modalHost");
  if (host) host.innerHTML = "";
}
