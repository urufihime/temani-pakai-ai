import { requireAuth, logout } from "./authGuard.js";
import { getUserProfile, getTasks, getJournalEntries, getRuleLogs, getTargets } from "./firestore.js";
import {
  escapeHtml,
  todayStr,
  daysAgoStr,
  riskLevelFromCounts,
  computeCombinedRisk,
  buildGaugeSVG,
  buildRuleComplianceSVG,
  buildTargetChartSVG,
  buildSemanticNetworkSVG,
  RISK_COPY,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  CATEGORY_META
} from "./utils.js";

const root = document.getElementById("root");
document.getElementById("logoutBtn").addEventListener("click", logout);

let CURRENT_USER = null;
let PROFILE = null;
let TASKS = [];
let JOURNAL = [];
let RULE_LOGS = [];
let TARGETS = [];
let activeFilter = "semua";
let weeksAgo = 0;

requireAuth(async (user) => {
  CURRENT_USER = user;
  PROFILE = await getUserProfile(user.uid);
  document.getElementById("userGreeting").textContent = `${PROFILE.name} · ${PROFILE.role === "dosen" ? "Dosen" : "Mahasiswa"}`;

  if (PROFILE.role === "dosen") {
    root.innerHTML = `
      <div class="card">
        <p class="empty">Halaman riwayat ini khusus untuk mahasiswa. Kamu bisa memantau kelasmu lewat dashboard.</p>
        <a href="dashboard.html" class="btn btn-primary" style="text-decoration:none;">Ke Dashboard</a>
      </div>
    `;
    return;
  }

  [TASKS, JOURNAL, RULE_LOGS, TARGETS] = await Promise.all([
    getTasks(CURRENT_USER.uid),
    getJournalEntries(CURRENT_USER.uid),
    getRuleLogs(CURRENT_USER.uid),
    getTargets(CURRENT_USER.uid)
  ]);
  render();
});

function getViewDate() {
  return weeksAgo === 0 ? todayStr() : daysAgoStr(weeksAgo * 7);
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmt(d) {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function buildWeeklyTrend(refDateStr) {
  const currentMonday = getMonday(new Date(refDateStr + "T00:00:00"));
  const weeks = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(currentMonday);
    start.setDate(currentMonday.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const inWeek = TASKS.filter((t) => t.date >= startStr && t.date <= endStr);
    const total = inWeek.length;
    const veryCount = inWeek.filter((t) => (CATEGORY_META[t.category] ? CATEGORY_META[t.category].value : 0) >= 4).length;
    const level = riskLevelFromCounts(total, veryCount);

    weeks.push({ label: `${fmt(start)}–${fmt(end)}`, total, veryCount, level, isCurrent: i === 0 });
  }
  return weeks;
}

function render() {
  const viewDate = getViewDate();
  const isHistorical = weeksAgo > 0;

  const weeks = buildWeeklyTrend(viewDate);
  const maxTotal = Math.max(1, ...weeks.map((w) => w.total));

  const tasksUpToView = TASKS.filter((t) => t.date <= viewDate);
  const journalUpToView = JOURNAL.filter((j) => j.date <= viewDate);
  const filteredTasks = activeFilter === "semua" ? tasksUpToView : tasksUpToView.filter((t) => t.category === activeFilter);

  const risk = computeCombinedRisk(PROFILE.assessmentScore, TASKS, viewDate);
  const riskCopy = RISK_COPY[risk.level];

  const sliderPresets = [
    { w: 0, label: "Hari Ini" },
    { w: 1, label: "1 Minggu Lalu" },
    { w: 4, label: "1 Bulan Lalu" },
    { w: 8, label: "2 Bulan Lalu" },
    { w: 12, label: "3 Bulan Lalu" }
  ];

  root.innerHTML = `
    <div class="card">
      <div class="card-head"><h2>Tinjau Waktu</h2><span class="tag">${isHistorical ? `Per ${viewDate}` : "Hari ini"}</span></div>
      <input type="range" id="timeSlider" min="0" max="24" step="1" value="${weeksAgo}" style="width:100%;">
      <div style="display:flex;justify-content:space-between;font-size:10.5px;font-family:'IBM Plex Mono',monospace;color:#847d63;margin-top:2px;">
        <span>24 minggu lalu</span><span>Hari ini</span>
      </div>
      <div class="pillset" id="timePresetPillset" style="margin-top:12px;">
        ${sliderPresets.map((p) => `<button type="button" class="pill" data-weeks="${p.w}" data-active="${weeksAgo === p.w}">${p.label}</button>`).join("")}
      </div>
      ${isHistorical ? `<p class="note" style="margin-top:12px;">Semua bagian di bawah menampilkan kondisi per <strong>${viewDate}</strong> (${weeksAgo} minggu lalu), dihitung dari data sampai tanggal itu saja.</p>` : ""}
    </div>

    <div class="card">
      <div class="card-head"><h2>Peringatan Dini</h2><span class="tag">${isHistorical ? `Per ${viewDate}` : "Saat ini"}</span></div>
      <div class="gauge-wrap">${buildGaugeSVG(risk.continuous / 3)}</div>
      <p class="gauge-level-line">Level: <strong>${riskCopy.label.replace(/^.*: /, "") || riskCopy.label}</strong> · ${risk.veryCount}/${risk.weekTotal} tugas 7 hari itu "Sangat Bergantung"</p>
    </div>

    <div class="card">
      <div class="card-head"><h2>Tren Risiko Mingguan</h2><span class="tag">6 minggu s/d ${isHistorical ? viewDate : "sekarang"}</span></div>
      ${weeks.map((w) => `
        <div class="week-row">
          <span class="week-label">${w.label}${w.isCurrent ? " (ini)" : ""}</span>
          <div class="week-bar-track"><div class="week-bar-fill ${w.level}" style="width:${(w.total / maxTotal) * 100}%;"></div></div>
          <span class="week-count">${w.total} tugas · ${RISK_COPY[w.level].label}</span>
        </div>
      `).join("")}
      <p class="note">Panjang batang menunjukkan jumlah tugas per minggu; warna menunjukkan tingkat risiko minggu tersebut.</p>
    </div>

    <div class="card">
      <div class="card-head"><h2>Kepatuhan Aturan</h2><span class="tag">7 hari s/d ${isHistorical ? viewDate : "sekarang"}</span></div>
      ${buildRuleComplianceSVG(RULE_LOGS, 7, viewDate)}
    </div>

    ${TARGETS.length > 0 ? `
    <div class="card">
      <div class="card-head"><h2>Target Semester</h2><span class="tag">${TARGETS.length} target</span></div>
      ${TARGETS.map((t) => `
        <div class="target-card">
          <div class="target-card-head">
            <div>
              <h4>${escapeHtml(t.title)}</h4>
              <span class="course-tag">${escapeHtml(t.course)}</span>
            </div>
          </div>
          ${buildTargetChartSVG(t, TASKS, viewDate)}
        </div>
      `).join("")}
    </div>` : ""}

    <div class="card">
      <div class="card-head"><h2>Semua Aktivitas</h2><span class="tag">${tasksUpToView.length}${isHistorical ? ` s/d ${viewDate}` : " total"}</span></div>
      <div class="pillset filter-pillset" id="filterPillset">
        <button type="button" class="pill" data-filter="semua" data-active="${activeFilter === "semua"}">Semua</button>
        ${CATEGORY_ORDER.map((key) => `
          <button type="button" class="pill" data-cat="${key}" data-filter="${key}" data-active="${activeFilter === key}">${CATEGORY_META[key].short}</button>
        `).join("")}
      </div>
      ${filteredTasks.length === 0
        ? `<p class="empty">Tidak ada tugas pada kategori/rentang waktu ini.</p>`
        : filteredTasks.map((t) => `
          <div class="ledger-row">
            <span class="ledger-date">${t.date}</span>
            <span>${escapeHtml(t.course)} — ${escapeHtml(t.title)}</span>
            <span class="badge badge-${t.category}">${CATEGORY_LABEL[t.category]}</span>
            <span></span>
          </div>
        `).join("")}
    </div>

    <div class="card">
      <div class="card-head"><h2>Riwayat Jurnal</h2><span class="tag">${journalUpToView.length} entri</span></div>
      ${journalUpToView.length === 0
        ? `<p class="empty">Belum ada refleksi jurnal${isHistorical ? " sampai tanggal ini" : ""}.</p>`
        : journalUpToView.map((j) => `
          <div class="journal-entry">
            <div class="journal-date">${j.date}</div>
            <div>${escapeHtml(j.text)}</div>
          </div>
        `).join("")}
    </div>

    <div class="card">
      <div class="card-head"><h2>Peta Jaringan Semantik Jurnal</h2><span class="tag">${journalUpToView.length} entri dianalisis</span></div>
      ${buildSemanticNetworkSVG(journalUpToView)}
    </div>
  `;

  document.getElementById("timeSlider").addEventListener("input", (e) => {
    weeksAgo = Number(e.target.value);
    render();
  });
  document.getElementById("timePresetPillset").addEventListener("click", (e) => {
    const pill = e.target.closest(".pill");
    if (!pill) return;
    weeksAgo = Number(pill.dataset.weeks);
    render();
  });
  document.getElementById("filterPillset").addEventListener("click", (e) => {
    const pill = e.target.closest(".pill");
    if (!pill) return;
    activeFilter = pill.dataset.filter;
    render();
  });
}
