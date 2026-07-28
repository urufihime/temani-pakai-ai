import { requireAuth, logout } from "./authGuard.js";
import { getUserProfile, getTasks, getJournalEntries } from "./firestore.js";
import { escapeHtml, riskLevelFromCounts, RISK_COPY, CATEGORY_LABEL } from "./utils.js";

const root = document.getElementById("root");
document.getElementById("logoutBtn").addEventListener("click", logout);

let CURRENT_USER = null;
let PROFILE = null;
let TASKS = [];
let JOURNAL = [];
let activeFilter = "semua";

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

  [TASKS, JOURNAL] = await Promise.all([getTasks(CURRENT_USER.uid), getJournalEntries(CURRENT_USER.uid)]);
  render();
});

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

function buildWeeklyTrend() {
  const currentMonday = getMonday(new Date());
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
    const veryCount = inWeek.filter((t) => t.category === "sangat").length;
    const level = riskLevelFromCounts(total, veryCount);

    weeks.push({ label: `${fmt(start)}–${fmt(end)}`, total, veryCount, level, isCurrent: i === 0 });
  }
  return weeks;
}

function render() {
  const weeks = buildWeeklyTrend();
  const maxTotal = Math.max(1, ...weeks.map((w) => w.total));

  const filteredTasks = activeFilter === "semua" ? TASKS : TASKS.filter((t) => t.category === activeFilter);

  root.innerHTML = `
    <div class="card">
      <div class="card-head"><h2>Tren Risiko Mingguan</h2><span class="tag">6 minggu terakhir</span></div>
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
      <div class="card-head"><h2>Semua Tugas</h2><span class="tag">${TASKS.length} total</span></div>
      <div class="pillset filter-pillset" id="filterPillset">
        <button type="button" class="pill" data-filter="semua" data-active="${activeFilter === "semua"}">Semua</button>
        <button type="button" class="pill" data-cat="mandiri" data-filter="mandiri" data-active="${activeFilter === "mandiri"}">Mandiri</button>
        <button type="button" class="pill" data-cat="sebagian" data-filter="sebagian" data-active="${activeFilter === "sebagian"}">Sebagian AI</button>
        <button type="button" class="pill" data-cat="sangat" data-filter="sangat" data-active="${activeFilter === "sangat"}">Sangat AI</button>
      </div>
      ${filteredTasks.length === 0
        ? `<p class="empty">Tidak ada tugas pada kategori ini.</p>`
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
      <div class="card-head"><h2>Riwayat Jurnal</h2><span class="tag">${JOURNAL.length} entri</span></div>
      ${JOURNAL.length === 0
        ? `<p class="empty">Belum ada refleksi jurnal.</p>`
        : JOURNAL.map((j) => `
          <div class="journal-entry">
            <div class="journal-date">${j.date}</div>
            <div>${escapeHtml(j.text)}</div>
          </div>
        `).join("")}
    </div>
  `;

  document.getElementById("filterPillset").addEventListener("click", (e) => {
    const pill = e.target.closest(".pill");
    if (!pill) return;
    activeFilter = pill.dataset.filter;
    render();
  });
}
