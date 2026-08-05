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
  listenUnreadConversations,
  addTarget,
  getTargets,
  deleteTarget
} from "./firestore.js";
import { escapeHtml, todayStr, RISK_COPY, buildGaugeSVG, computeCombinedRisk, buildWeekChartSVG, buildSemanticNetworkSVG, buildRuleComplianceSVG, buildTargetChartSVG, CATEGORY_ORDER, CATEGORY_META, CATEGORY_LABEL } from "./utils.js";

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
let TARGETS = [];
let taskDraft = { course: "", title: "", category: "cukup_mandiri" };
let ruleDraft = "";
let journalDraft = "";
let targetDraft = { course: "", title: "", startCategory: "sangat_bergantung", endCategory: "sangat_mandiri", startDate: todayStr() };

// tab aktif dashboard mahasiswa
let activeTab = "ringkasan";

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
  [TASKS, RULES, RULE_LOGS, JOURNAL, TARGETS] = await Promise.all([
    getTasks(CURRENT_USER.uid),
    getRules(CURRENT_USER.uid),
    getRuleLogs(CURRENT_USER.uid),
    getJournalEntries(CURRENT_USER.uid),
    getTargets(CURRENT_USER.uid)
  ]);
}

const DASH_TABS = [
  { key: "ringkasan", label: "Ringkasan" },
  { key: "aktivitas", label: "Aktivitas & Aturan" },
  { key: "target", label: "Target Semester" },
  { key: "jurnal", label: "Jurnal" }
];

function renderMahasiswaDashboard() {
  root.innerHTML = `
    <div class="dash-shortcuts">
      <a href="chat.html" id="chatNavLink" class="btn btn-ghost btn-small" style="text-decoration:none;">Chat</a>
      <a href="history.html" class="btn btn-ghost btn-small" style="text-decoration:none;">Riwayat</a>
      <a href="profile.html" class="btn btn-ghost btn-small" style="text-decoration:none;">Profil</a>
    </div>

    <div class="dash-tabs" id="dashTabs">
      ${DASH_TABS.map((t) => `<button type="button" class="tab-btn" data-tab="${t.key}" data-active="${activeTab === t.key}">${t.label}</button>`).join("")}
    </div>

    <div id="tabContent">${renderActiveTab()}</div>
  `;

  bindMahasiswaEvents();
  attachChatBadge();
}

function renderActiveTab() {
  if (activeTab === "aktivitas") return renderAktivitasTab();
  if (activeTab === "target") return renderTargetTab();
  if (activeTab === "jurnal") return renderJurnalTab();
  return renderRingkasanTab();
}

/* ===== Tab: Ringkasan — fokus utama dashboard ===== */
function renderRingkasanTab() {
  const risk = computeCombinedRisk(PROFILE.assessmentScore, TASKS, todayStr());
  const copy = RISK_COPY[risk.level];

  return `
    <div class="card">
      <div class="card-head"><h2>Peringatan Dini</h2><span class="tag">Gauge ketergantungan</span></div>
      <div class="gauge-wrap">${buildGaugeSVG(risk.continuous / 3)}</div>
      <p class="gauge-level-line">Level saat ini: <strong>${copy.label.replace(/^.*: /, "") || copy.label}</strong> · ${risk.veryCount}/${risk.weekTotal} tugas 7 hari terakhir "Sangat Bergantung"</p>
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
      <div class="card-head"><h2>Peta Jaringan Semantik Jurnal</h2><span class="tag">${JOURNAL.length} entri dianalisis</span></div>
      ${buildSemanticNetworkSVG(JOURNAL)}
      <a href="history.html" class="btn btn-ghost btn-small" style="text-decoration:none;display:inline-block;margin-top:12px;">Tinjau kondisi di waktu lain →</a>
    </div>
  `;
}

/* ===== Tab: Aktivitas & Aturan ===== */
function renderAktivitasTab() {
  const recentTasks = TASKS.slice(0, 5);

  return `
    <div class="card">
      <div class="card-head"><h2>Catat Aktivitas Baru</h2></div>
      <div class="field-row">
        <div>
          <label for="taskCourse">Mata Kuliah</label>
          <input type="text" id="taskCourse" placeholder="Contoh: Basis Data" value="${escapeHtml(taskDraft.course)}">
        </div>
        <div>
          <label for="taskTitle">Nama Aktivitas</label>
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
      ${recentTasks.length === 0
        ? `<p class="empty">Belum ada tugas dicatat.</p>`
        : recentTasks.map((t) => `
          <div class="ledger-row">
            <span class="ledger-date">${t.date}</span>
            <span>${escapeHtml(t.course)} — ${escapeHtml(t.title)}</span>
            <span class="badge badge-${t.category}">${CATEGORY_LABEL[t.category] || t.category}</span>
            <button class="ledger-delete" data-id="${t.id}" title="Hapus">✕</button>
          </div>
        `).join("")}
      ${TASKS.length > 5 ? `<a href="history.html" class="btn btn-ghost btn-small" style="text-decoration:none;display:inline-block;margin-top:12px;">Lihat semua tugas & tren →</a>` : ""}
    </div>

    <div class="card">
      <div class="card-head"><h2>Aturan Pribadi</h2><span class="tag">Kepatuhan 7 hari</span></div>
      ${buildRuleComplianceSVG(RULE_LOGS)}
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
  `;
}

/* ===== Tab: Target Semester ===== */
function renderTargetTab() {
  return `
    <div class="card">
      <div class="card-head"><h2>Target Individu dalam Satu Semester</h2><span class="tag">19 minggu / mata kuliah</span></div>
      <p class="helptext" style="margin-top:0;">Buat target untuk mata kuliah tertentu — target besarmu otomatis dipecah ke sepanjang durasi pemakaian alat ini per mata kuliah: 14 pertemuan + 2 minggu UTS + 2 minggu UAS + 1 minggu evaluasi (19 minggu total), dibandingkan dengan capaian nyata dari tugas yang kamu catat.</p>

      <div class="field-row">
        <div>
          <label for="targetCourse">Mata Kuliah</label>
          <input type="text" id="targetCourse" list="courseList" placeholder="Contoh: Basis Data" value="${escapeHtml(targetDraft.course)}">
          <datalist id="courseList">
            ${[...new Set(TASKS.map((t) => t.course))].map((c) => `<option value="${escapeHtml(c)}">`).join("")}
          </datalist>
        </div>
        <div>
          <label for="targetTitle">Judul Target</label>
          <input type="text" id="targetTitle" placeholder="Contoh: Lebih mandiri di tugas Basis Data" value="${escapeHtml(targetDraft.title)}">
        </div>
      </div>
      <div class="field-row">
        <div>
          <label for="targetStartCat">Titik Awal (saat ini)</label>
          <select id="targetStartCat">
            ${CATEGORY_ORDER.map((key) => `<option value="${key}" ${targetDraft.startCategory === key ? "selected" : ""}>${CATEGORY_META[key].short}</option>`).join("")}
          </select>
        </div>
        <div>
          <label for="targetEndCat">Target Akhir (minggu ke-19)</label>
          <select id="targetEndCat">
            ${CATEGORY_ORDER.map((key) => `<option value="${key}" ${targetDraft.endCategory === key ? "selected" : ""}>${CATEGORY_META[key].short}</option>`).join("")}
          </select>
        </div>
      </div>
      <label for="targetStartDate">Tanggal Mulai (minggu ke-1)</label>
      <input type="date" id="targetStartDate" value="${targetDraft.startDate}">

      <button class="btn btn-primary btn-small" id="addTargetBtn">Buat Target</button>

      <div style="margin-top:20px;">
        ${TARGETS.length === 0
          ? `<p class="empty">Belum ada target semester. Buat target pertamamu di atas.</p>`
          : TARGETS.map((t) => `
            <div class="target-card">
              <div class="target-card-head">
                <div>
                  <h4>${escapeHtml(t.title)}</h4>
                  <span class="course-tag">${escapeHtml(t.course)}</span>
                </div>
                <button class="ledger-delete" data-deltarget="${t.id}" title="Hapus target">✕</button>
              </div>
              ${buildTargetChartSVG(t, TASKS)}
            </div>
          `).join("")}
      </div>
    </div>
  `;
}

/* ===== Tab: Jurnal ===== */
function renderJurnalTab() {
  return `
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
        </div>
        ${JOURNAL.length > 5 ? `<a href="history.html" class="btn btn-ghost btn-small" style="text-decoration:none;display:inline-block;margin-top:12px;">Lihat semua jurnal →</a>` : ""}
      ` : ""}
    </div>
  `;
}

function bindMahasiswaEvents() {
  // Helper: pasang listener hanya kalau elemennya ada di tab yang sedang aktif.
  const on = (id, evt, handler) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(evt, handler);
  };

  // ===== Navigasi tab =====
  const dashTabs = document.getElementById("dashTabs");
  if (dashTabs) {
    dashTabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".tab-btn");
      if (!btn) return;
      activeTab = btn.dataset.tab;
      renderMahasiswaDashboard();
    });
  }

  // ===== Catat Aktivitas Baru =====
  on("taskCourse", "input", (e) => (taskDraft.course = e.target.value));
  on("taskTitle", "input", (e) => (taskDraft.title = e.target.value));

  const taskCatPillset = document.getElementById("taskCatPillset");
  if (taskCatPillset) {
    taskCatPillset.addEventListener("click", (e) => {
      const pill = e.target.closest(".pill");
      if (!pill) return;
      taskDraft.category = pill.dataset.cat;
      renderMahasiswaDashboard();
    });
  }

  on("addTaskBtn", "click", async () => {
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

  // ===== Aturan Pribadi =====
  on("ruleInput", "input", (e) => (ruleDraft = e.target.value));
  on("addRuleBtn", "click", async () => {
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

  // ===== Jurnal Refleksi =====
  on("journalInput", "input", (e) => (journalDraft = e.target.value));
  on("addJournalBtn", "click", async () => {
    if (!journalDraft.trim()) return;
    await addJournalEntry(CURRENT_USER.uid, journalDraft.trim());
    journalDraft = "";
    JOURNAL = await getJournalEntries(CURRENT_USER.uid);
    renderMahasiswaDashboard();
  });

  // ===== Target Semester =====
  on("targetCourse", "input", (e) => (targetDraft.course = e.target.value));
  on("targetTitle", "input", (e) => (targetDraft.title = e.target.value));
  on("targetStartCat", "change", (e) => (targetDraft.startCategory = e.target.value));
  on("targetEndCat", "change", (e) => (targetDraft.endCategory = e.target.value));
  on("targetStartDate", "change", (e) => (targetDraft.startDate = e.target.value));

  on("addTargetBtn", "click", async () => {
    if (!targetDraft.course.trim() || !targetDraft.title.trim()) {
      alert("Isi mata kuliah dan judul target dulu.");
      return;
    }
    await addTarget(CURRENT_USER.uid, { ...targetDraft, course: targetDraft.course.trim(), title: targetDraft.title.trim() });
    targetDraft = { course: "", title: "", startCategory: "sangat_bergantung", endCategory: "sangat_mandiri", startDate: todayStr() };
    TARGETS = await getTargets(CURRENT_USER.uid);
    renderMahasiswaDashboard();
  });

  root.querySelectorAll("[data-deltarget]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await deleteTarget(CURRENT_USER.uid, btn.dataset.deltarget);
      TARGETS = await getTargets(CURRENT_USER.uid);
      renderMahasiswaDashboard();
    });
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
      <a href="profile.html" class="btn btn-ghost btn-small" style="text-decoration:none;">Profil</a>
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
