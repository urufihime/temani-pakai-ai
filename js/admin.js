import { requireAuth, logout } from "./authGuard.js";
import {
  getUserProfile,
  getAllInstitutions,
  createInstitution,
  updateInstitution,
  deleteInstitution,
  countUsersInInstitution,
  getInstitution,
  createDemoProgram,
  getDemoProgram,
  getAllDemoPrograms,
  updateDemoProgram,
  deleteDemoProgram,
  getAllUsers,
  adminUpdateUser
} from "./firestore.js";
import { escapeHtml, todayStr } from "./utils.js";

const root = document.getElementById("root");
document.getElementById("logoutBtn").addEventListener("click", logout);

let ME = null;
let INSTITUTIONS = [];
let DEMO_PROGRAMS = [];
let newInstDraft = { kode: "", nama: "", expiresAt: "", catatan: "" };
let demoDraft = { name: "", code: "", maxLecturers: 20, registrationEndsAt: "", accessEndsAt: "" };

requireAuth(async (user) => {
  ME = await getUserProfile(user.uid);
  document.getElementById("userGreeting").textContent = `${ME.name} · Admin`;

  if (ME.role !== "admin") {
    root.innerHTML = `
      <div class="card">
        <p class="empty">Halaman ini khusus untuk admin.</p>
        <a href="dashboard.html" class="btn btn-primary" style="text-decoration:none;">Ke Dashboard</a>
      </div>
    `;
    return;
  }

  await loadInstitutions();
  await loadDemoPrograms();
  await loadUsers();
  render();
});

async function loadDemoPrograms() {
  DEMO_PROGRAMS = await getAllDemoPrograms();
  DEMO_PROGRAMS.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

function generateDemoCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `DEMO-${[...bytes].map((b) => chars[b % chars.length]).join("")}`;
}

function formatTimestamp(value) {
  return value?.toDate ? value.toDate().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

async function loadInstitutions() {
  const list = await getAllInstitutions();
  const counts = await Promise.all(list.map((i) => countUsersInInstitution(i.id)));
  INSTITUTIONS = list.map((i, idx) => ({ ...i, userCount: counts[idx] }));
  INSTITUTIONS.sort((a, b) => (a.nama || "").localeCompare(b.nama || ""));
}

function statusOf(inst) {
  if (inst.status !== "aktif") return "nonaktif";
  if (inst.expiresAt && inst.expiresAt < todayStr()) return "expired";
  return "aktif";
}

function statusLabel(s) {
  return { aktif: "Aktif", nonaktif: "Nonaktif", expired: "Kadaluarsa" }[s] || s;
}

function render() {
  const totalUsers = INSTITUTIONS.reduce((sum, i) => sum + i.userCount, 0);
  const totalAktif = INSTITUTIONS.filter((i) => statusOf(i) === "aktif").length;

  root.innerHTML = `
    <div class="stat-row">
      <div class="stat-box"><div class="n">${INSTITUTIONS.length}</div><div class="l">Total Institusi</div></div>
      <div class="stat-box"><div class="n">${totalAktif}</div><div class="l">Aktif</div></div>
      <div class="stat-box"><div class="n">${totalUsers}</div><div class="l">Total User</div></div>
    </div>

    <div class="card" id="usersSection"></div>

    <div class="card">
      <div class="card-head"><h2>Tambah Institusi Baru</h2></div>
      <div class="field-row">
        <div>
          <label for="instKode">Kode Institusi</label>
          <input type="text" id="instKode" placeholder="Contoh: UNIV-ABC-2026" value="${escapeHtml(newInstDraft.kode)}">
          <p class="helptext" style="margin-top:-8px;">Ini yang dipakai user saat daftar. Sekali dibuat, kode tidak bisa diubah.</p>
        </div>
        <div>
          <label for="instNama">Nama Institusi</label>
          <input type="text" id="instNama" placeholder="Contoh: Universitas ABC" value="${escapeHtml(newInstDraft.nama)}">
        </div>
      </div>
      <div class="field-row">
        <div>
          <label for="instExpires">Berlaku Sampai (opsional)</label>
          <input type="date" id="instExpires" value="${newInstDraft.expiresAt}">
        </div>
        <div>
          <label for="instCatatan">Catatan (opsional)</label>
          <input type="text" id="instCatatan" placeholder="Kontak PIC, paket langganan, dll." value="${escapeHtml(newInstDraft.catatan)}">
        </div>
      </div>
      <button class="btn btn-primary" id="addInstBtn">Tambah Institusi</button>
    </div>

    <div class="card">
      <div class="card-head"><h2>Program Demo Dosen</h2><span class="tag">SATU KODE · BANYAK DOSEN</span></div>
      <p class="helptext" style="margin-top:0;">Dosen dari institusi mana pun dapat memakai kode yang sama. Setiap dosen otomatis mendapat ruang data terpisah.</p>
      <div class="field-row">
        <div>
          <label for="demoName">Nama Program</label>
          <input type="text" id="demoName" placeholder="Demo Dosen September 2026" value="${escapeHtml(demoDraft.name)}">
        </div>
        <div>
          <label for="demoCode">Kode Demo</label>
          <div style="display:flex;gap:8px;"><input type="text" id="demoCode" value="${escapeHtml(demoDraft.code)}" style="margin-bottom:0;"><button type="button" class="btn btn-ghost btn-small" id="generateDemoCodeBtn">Buat Kode</button></div>
        </div>
      </div>
      <div class="field-row">
        <div><label for="demoQuota">Kuota Dosen</label><input type="number" id="demoQuota" min="1" max="500" value="${demoDraft.maxLecturers}"></div>
        <div><label for="demoRegistrationEnd">Pendaftaran Sampai</label><input type="date" id="demoRegistrationEnd" value="${demoDraft.registrationEndsAt}"></div>
      </div>
      <label for="demoAccessEnd">Akses Demo Sampai</label>
      <input type="date" id="demoAccessEnd" value="${demoDraft.accessEndsAt}">
      <button class="btn btn-primary" id="createDemoBtn">Buat Program Demo</button>

      <div style="margin-top:24px;">
        ${DEMO_PROGRAMS.length === 0 ? `<p class="empty">Belum ada program demo.</p>` : `
          <table class="class-table">
            <thead><tr><th>Program</th><th>Kode</th><th>Terdaftar</th><th>Akses s/d</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>${DEMO_PROGRAMS.map((d) => `
              <tr>
                <td>${escapeHtml(d.name)}</td>
                <td style="font-family:'IBM Plex Mono',monospace;font-size:12px;">${escapeHtml(d.id)}</td>
                <td>${d.registeredCount || 0}/${d.maxLecturers}</td>
                <td>${formatTimestamp(d.accessEndsAt)}</td>
                <td>${d.status === "aktif" ? "Aktif" : "Nonaktif"}</td>
                <td><div class="inst-row-actions">
                  <button class="btn btn-ghost btn-small" data-copydemo="${escapeHtml(d.id)}">Salin Tautan</button>
                  <button class="btn btn-ghost btn-small" data-toggledemo="${escapeHtml(d.id)}" data-current="${d.status}">${d.status === "aktif" ? "Hentikan" : "Aktifkan"}</button>
                  <button class="btn btn-ghost btn-small" data-extenddemo="${escapeHtml(d.id)}">Perpanjang</button>
                  ${(d.registeredCount || 0) === 0 ? `<button class="ledger-delete" data-deldemo="${escapeHtml(d.id)}" title="Hapus program">✕</button>` : ""}
                </div></td>
              </tr>`).join("")}</tbody>
          </table>`}
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>Semua Institusi</h2><span class="tag">${INSTITUTIONS.length} institusi</span></div>
      ${INSTITUTIONS.length === 0 ? `<p class="empty">Belum ada institusi. Tambahkan lewat form di atas.</p>` : `
        <table class="class-table">
          <thead><tr><th>Nama</th><th>Kode</th><th>Status</th><th>Berlaku s/d</th><th>User</th><th>Aksi</th></tr></thead>
          <tbody>
            ${INSTITUTIONS.map((i) => {
              const s = statusOf(i);
              return `
              <tr>
                <td>${escapeHtml(i.nama)}</td>
                <td style="font-family:'IBM Plex Mono',monospace;font-size:12px;">${escapeHtml(i.id)}</td>
                <td><span class="status-badge ${s}">${statusLabel(s)}</span></td>
                <td>${i.expiresAt ? escapeHtml(i.expiresAt) : "—"}</td>
                <td>${i.userCount}</td>
                <td>
                  <div class="inst-row-actions">
                    <button class="btn btn-ghost btn-small" data-toggle="${escapeHtml(i.id)}" data-current="${i.status}">${i.status === "aktif" ? "Nonaktifkan" : "Aktifkan"}</button>
                    <button class="btn btn-ghost btn-small" data-editexpiry="${escapeHtml(i.id)}">Ubah Tgl</button>
                    <button class="ledger-delete" data-delinst="${escapeHtml(i.id)}" title="Hapus institusi">✕</button>
                  </div>
                </td>
              </tr>
            `;
            }).join("")}
          </tbody>
        </table>
      `}
    </div>
  `;

  bindEvents();
  renderUsersSection();
}

function bindEvents() {
  document.getElementById("instKode").addEventListener("input", (e) => (newInstDraft.kode = e.target.value));
  document.getElementById("instNama").addEventListener("input", (e) => (newInstDraft.nama = e.target.value));
  document.getElementById("instExpires").addEventListener("input", (e) => (newInstDraft.expiresAt = e.target.value));
  document.getElementById("instCatatan").addEventListener("input", (e) => (newInstDraft.catatan = e.target.value));
  document.getElementById("demoName").addEventListener("input", (e) => (demoDraft.name = e.target.value));
  document.getElementById("demoCode").addEventListener("input", (e) => (demoDraft.code = e.target.value.toUpperCase()));
  document.getElementById("demoQuota").addEventListener("input", (e) => (demoDraft.maxLecturers = Number(e.target.value)));
  document.getElementById("demoRegistrationEnd").addEventListener("input", (e) => (demoDraft.registrationEndsAt = e.target.value));
  document.getElementById("demoAccessEnd").addEventListener("input", (e) => (demoDraft.accessEndsAt = e.target.value));
  document.getElementById("generateDemoCodeBtn").addEventListener("click", () => {
    demoDraft.code = generateDemoCode();
    document.getElementById("demoCode").value = demoDraft.code;
  });

  document.getElementById("createDemoBtn").addEventListener("click", async () => {
    const code = demoDraft.code.trim().toUpperCase();
    if (!demoDraft.name.trim() || !code || !demoDraft.registrationEndsAt || !demoDraft.accessEndsAt || demoDraft.maxLecturers < 1) {
      alert("Lengkapi nama, kode, kuota, dan kedua tanggal program demo.");
      return;
    }
    if (new Date(demoDraft.accessEndsAt) < new Date(demoDraft.registrationEndsAt)) {
      alert("Tanggal akhir akses tidak boleh sebelum batas pendaftaran.");
      return;
    }
    if (await getDemoProgram(code)) {
      alert("Kode demo sudah digunakan. Buat kode lain.");
      return;
    }
    await createDemoProgram(code, { ...demoDraft, code, name: demoDraft.name.trim() });
    demoDraft = { name: "", code: "", maxLecturers: 20, registrationEndsAt: "", accessEndsAt: "" };
    await loadDemoPrograms();
    render();
  });

  document.querySelectorAll("[data-copydemo]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const url = new URL("register-dosen.html", window.location.href);
      url.searchParams.set("demo", btn.dataset.copydemo);
      await navigator.clipboard.writeText(url.href);
      btn.textContent = "Tersalin";
    });
  });

  document.querySelectorAll("[data-toggledemo]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await updateDemoProgram(btn.dataset.toggledemo, { status: btn.dataset.current === "aktif" ? "nonaktif" : "aktif" });
      await loadDemoPrograms();
      render();
    });
  });

  document.querySelectorAll("[data-extenddemo]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const value = prompt("Akses demo diperpanjang sampai tanggal berapa? (YYYY-MM-DD)");
      if (!value) return;
      await updateDemoProgram(btn.dataset.extenddemo, { accessEndsAt: value });
      await loadDemoPrograms();
      render();
    });
  });

  document.querySelectorAll("[data-deldemo]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Hapus program demo yang belum digunakan ini?")) return;
      await deleteDemoProgram(btn.dataset.deldemo);
      await loadDemoPrograms();
      render();
    });
  });

  document.getElementById("addInstBtn").addEventListener("click", async () => {
    const kode = newInstDraft.kode.trim();
    const nama = newInstDraft.nama.trim();
    if (!kode || !nama) {
      alert("Isi kode dan nama institusi dulu.");
      return;
    }

    const existing = await getInstitution(kode);
    if (existing) {
      alert("Kode institusi ini sudah dipakai. Pakai kode lain.");
      return;
    }

    const btn = document.getElementById("addInstBtn");
    btn.disabled = true;
    btn.textContent = "Menyimpan…";

    await createInstitution(kode, {
      nama,
      status: "aktif",
      expiresAt: newInstDraft.expiresAt || null,
      catatan: newInstDraft.catatan.trim()
    });

    newInstDraft = { kode: "", nama: "", expiresAt: "", catatan: "" };
    await loadInstitutions();
    render();
  });

  document.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const newStatus = btn.dataset.current === "aktif" ? "nonaktif" : "aktif";
      await updateInstitution(btn.dataset.toggle, { status: newStatus });
      await loadInstitutions();
      render();
    });
  });

  document.querySelectorAll("[data-editexpiry]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const inst = INSTITUTIONS.find((i) => i.id === btn.dataset.editexpiry);
      const val = prompt("Berlaku sampai tanggal berapa? (format YYYY-MM-DD, kosongkan untuk tanpa batas)", inst.expiresAt || "");
      if (val === null) return;
      await updateInstitution(btn.dataset.editexpiry, { expiresAt: val.trim() || null });
      await loadInstitutions();
      render();
    });
  });

  document.querySelectorAll("[data-delinst]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const inst = INSTITUTIONS.find((i) => i.id === btn.dataset.delinst);
      if (!confirm(`Hapus institusi "${inst.nama}"? User yang sudah daftar dengan kode ini tidak akan otomatis terhapus, tapi akan kehilangan akses.`)) return;
      await deleteInstitution(btn.dataset.delinst);
      await loadInstitutions();
      render();
    });
  });
}

/* ============================================================
   PENGGUNA — daftar, pemeriksa kecocokan kelas, dan ubah data
   ============================================================ */
const USER_ROW_LIMIT = 200;
let USERS = [];
let USERS_ERROR = "";
let userFilter = { q: "", role: "", inst: "", issue: "" };

const ISSUE_LABEL = {
  "no-inst": "Tanpa institusi",
  "bad-inst": "Institusi tidak terdaftar",
  "inst-off": "Institusi nonaktif",
  "codes-desync": "kelasCodes tidak sinkron",
  "no-kelas": "Belum isi kelas",
  "no-dosen": "Kode kelas tidak cocok"
};

// Samakan huruf besar/kecil, spasi, kurung, strip, dll. — hanya untuk mendeteksi
// kode yang "mirip". Pencocokan sungguhan di aplikasi tetap persis sama.
function normKode(s) {
  return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function loadUsers() {
  try {
    USERS = await getAllUsers();
    USERS_ERROR = "";
  } catch (err) {
    console.error(err);
    USERS = [];
    USERS_ERROR = err.code || err.message || "error";
  }
}

async function refreshAfterUserChange() {
  await loadUsers();
  await loadInstitutions();
  render();
}

function analyzeUsers() {
  const instById = new Map(INSTITUTIONS.map((i) => [i.id, i]));
  const dosens = USERS.filter((u) => u.role === "dosen");
  const codesOf = (d) => (Array.isArray(d.kelasCodes) ? d.kelasCodes : []);

  return USERS.map((u) => {
    const issues = [];
    let linkedDosen = [];
    if (u.role === "admin") return { u, issues, linkedDosen };

    const inst = u.institusiId ? instById.get(u.institusiId) : null;
    if (!u.institusiId) {
      issues.push({ type: "no-inst", level: "error", text: "Profil tidak punya institusiId, jadi Rules menolak aksesnya." });
    } else if (!inst) {
      issues.push({ type: "bad-inst", level: "error", text: `Institusi "${u.institusiId}" tidak ada di daftar institusi.` });
    } else if (statusOf(inst) !== "aktif") {
      issues.push({ type: "inst-off", level: "warn", text: `Institusi berstatus ${statusLabel(statusOf(inst)).toLowerCase()}.` });
    }

    if (u.role === "dosen") {
      const list = Array.isArray(u.kelasList) ? u.kelasList : [];
      const wanted = list.slice(0, 3).map((k) => k.kodeKelas);
      const codes = codesOf(u);
      if (list.length === 0) {
        issues.push({ type: "no-kelas", level: "warn", text: "Belum mengisi mata kuliah dan kode kelas." });
      } else if (wanted.length !== codes.length || wanted.some((c, i) => c !== codes[i])) {
        issues.push({ type: "codes-desync", level: "error", text: "kelasCodes berbeda dari kelasList.", fix: { kind: "sync" } });
      }
    } else if (u.role === "mahasiswa") {
      if (!u.kelas) {
        issues.push({ type: "no-kelas", level: "warn", text: "Belum mengisi kode kelas." });
      } else {
        const sameInst = dosens.filter((d) => d.institusiId && d.institusiId === u.institusiId);
        linkedDosen = sameInst.filter((d) => codesOf(d).includes(u.kelas));
        if (linkedDosen.length === 0) {
          let hint = "";
          let fix = null;
          const near = [];
          sameInst.forEach((d) => codesOf(d).forEach((c) => { if (normKode(c) === normKode(u.kelas)) near.push(c); }));
          if (near.length) {
            hint = ` Mirip dengan "${near[0]}" (beda huruf, spasi, atau tanda baca).`;
            fix = { kind: "usecode", code: near[0] };
          } else {
            const other = dosens.filter((d) => d.institusiId !== u.institusiId && codesOf(d).some((c) => normKode(c) === normKode(u.kelas)));
            if (other.length) hint = ` Kode itu dipakai dosen di institusi lain (${other[0].institusiId || "tanpa institusi"}).`;
            else if (sameInst.length === 0) hint = " Belum ada dosen di institusi ini.";
          }
          issues.push({ type: "no-dosen", level: "error", text: `Kode "${u.kelas}" tidak cocok dengan dosen mana pun di institusinya.${hint}`, fix });
        }
      }
    }
    return { u, issues, linkedDosen };
  });
}

function roleLabel(role) {
  return { mahasiswa: "Mahasiswa", dosen: "Dosen", admin: "Admin" }[role] || role || "—";
}

function renderUsersSection() {
  const host = document.getElementById("usersSection");
  if (!host) return;

  host.innerHTML = `
    <div class="card-head"><h2>Pengguna</h2><span class="tag" id="usersCount"></span></div>
    <p class="helptext" style="margin-top:0;">Periksa apakah dosen dan mahasiswa saling terhubung (institusi sama, kode kelas cocok), lalu perbaiki lewat tombol Ubah.</p>
    ${USERS_ERROR ? `<p class="empty">Daftar pengguna belum bisa dimuat (${escapeHtml(USERS_ERROR)}). Pastikan akun ini berperan admin dan Rules sudah dipublish.</p>` : ""}
    <div class="issue-chips" id="usersChips"></div>
    <div class="field-row">
      <div><label for="userQ">Cari</label><input type="text" id="userQ" placeholder="Nama, email, kode kelas, atau institusi" value="${escapeHtml(userFilter.q)}"></div>
      <div><label for="userRole">Peran</label>
        <select id="userRole">
          <option value="">Semua</option>
          <option value="mahasiswa"${userFilter.role === "mahasiswa" ? " selected" : ""}>Mahasiswa</option>
          <option value="dosen"${userFilter.role === "dosen" ? " selected" : ""}>Dosen</option>
          <option value="admin"${userFilter.role === "admin" ? " selected" : ""}>Admin</option>
        </select>
      </div>
    </div>
    <div class="field-row">
      <div><label for="userInst">Institusi</label>
        <select id="userInst">
          <option value="">Semua</option>
          <option value="__none__"${userFilter.inst === "__none__" ? " selected" : ""}>(tanpa institusi)</option>
          ${INSTITUTIONS.map((i) => `<option value="${escapeHtml(i.id)}"${userFilter.inst === i.id ? " selected" : ""}>${escapeHtml(i.nama || i.id)} (${escapeHtml(i.id)})</option>`).join("")}
        </select>
      </div>
      <div><label for="userIssue">Status</label>
        <select id="userIssue">
          <option value="">Semua</option>
          <option value="any"${userFilter.issue === "any" ? " selected" : ""}>Hanya yang bermasalah</option>
          ${Object.entries(ISSUE_LABEL).map(([k, v]) => `<option value="${k}"${userFilter.issue === k ? " selected" : ""}>${v}</option>`).join("")}
        </select>
      </div>
    </div>
    <div id="usersTable"></div>
  `;

  document.getElementById("userQ").addEventListener("input", (e) => { userFilter.q = e.target.value; updateUsersTable(); });
  document.getElementById("userRole").addEventListener("change", (e) => { userFilter.role = e.target.value; updateUsersTable(); });
  document.getElementById("userInst").addEventListener("change", (e) => { userFilter.inst = e.target.value; updateUsersTable(); });
  document.getElementById("userIssue").addEventListener("change", (e) => {
    userFilter.issue = e.target.value;
    document.getElementById("userIssue").value = userFilter.issue;
    updateUsersTable();
  });

  document.getElementById("usersTable").addEventListener("click", onUsersTableClick);
  document.getElementById("usersChips").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-chip]");
    if (!chip) return;
    userFilter.issue = chip.dataset.chip === userFilter.issue ? "" : chip.dataset.chip;
    document.getElementById("userIssue").value = userFilter.issue;
    updateUsersTable();
  });

  updateUsersTable();
}

function updateUsersTable() {
  const analysis = analyzeUsers();
  const withIssues = analysis.filter((a) => a.issues.length > 0);

  // Ringkasan masalah (chip bisa diklik untuk memfilter)
  const counts = {};
  analysis.forEach((a) => a.issues.forEach((i) => { counts[i.type] = (counts[i.type] || 0) + 1; }));
  document.getElementById("usersChips").innerHTML = withIssues.length === 0
    ? (USERS.length ? `<span class="issue-chip ok">Semua pengguna terhubung dengan benar</span>` : "")
    : `<button type="button" class="issue-chip ${userFilter.issue === "any" ? "active" : ""}" data-chip="any">${withIssues.length} pengguna bermasalah</button>` +
      Object.entries(counts).map(([k, n]) =>
        `<button type="button" class="issue-chip ${userFilter.issue === k ? "active" : ""}" data-chip="${k}">${ISSUE_LABEL[k]}: ${n}</button>`).join("");

  const q = userFilter.q.trim().toLowerCase();
  let rows = analysis.filter(({ u, issues }) => {
    if (userFilter.role && u.role !== userFilter.role) return false;
    if (userFilter.inst === "__none__" && u.institusiId) return false;
    if (userFilter.inst && userFilter.inst !== "__none__" && u.institusiId !== userFilter.inst) return false;
    if (userFilter.issue === "any" && issues.length === 0) return false;
    if (userFilter.issue && userFilter.issue !== "any" && !issues.some((i) => i.type === userFilter.issue)) return false;
    if (q) {
      const hay = [u.name, u.email, u.kelas, u.institusiId, ...(u.kelasCodes || [])].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Yang bermasalah tampil dulu, lalu urut nama.
  rows.sort((a, b) => (b.issues.length - a.issues.length) || String(a.u.name || "").localeCompare(String(b.u.name || "")));
  const total = rows.length;
  rows = rows.slice(0, USER_ROW_LIMIT);

  document.getElementById("usersCount").textContent = `${USERS.length} pengguna`;

  const table = document.getElementById("usersTable");
  if (rows.length === 0) {
    table.innerHTML = `<p class="empty">${USERS.length === 0 ? "Belum ada data pengguna." : "Tidak ada pengguna yang cocok dengan filter."}</p>`;
    return;
  }

  table.innerHTML = `
    <div class="table-scroll">
    <table class="class-table users-table">
      <thead><tr><th>Pengguna</th><th>Institusi</th><th>Kelas</th><th>Status</th><th>Aksi</th></tr></thead>
      <tbody>
        ${rows.map(({ u, issues, linkedDosen }) => {
          const inst = INSTITUTIONS.find((i) => i.id === u.institusiId);
          const kelasCell = u.role === "mahasiswa"
            ? `<div class="mono-sm">${u.kelas ? escapeHtml(u.kelas) : "—"}</div>${linkedDosen.length ? `<div class="muted-sm">→ ${linkedDosen.map((d) => escapeHtml(d.name || "Dosen")).join(", ")}</div>` : ""}`
            : u.role === "dosen"
              ? ((u.kelasList || []).length
                  ? (u.kelasList || []).map((k) => `<div class="mono-sm">${escapeHtml(k.kodeKelas || "")}</div><div class="muted-sm">${escapeHtml(k.mataKuliah || "")}</div>`).join("")
                  : "—")
              : "—";
          const statusCell = u.role === "admin"
            ? `<span class="muted-sm">—</span>`
            : issues.length === 0
              ? `<span class="status-badge aktif">OK</span>`
              : issues.map((i, idx) => `
                  <div class="user-issue ${i.level}">
                    ${escapeHtml(i.text)}
                    ${i.fix ? `<button type="button" class="btn btn-ghost btn-small" data-fix="${i.fix.kind}" data-uid="${escapeHtml(u.uid)}" ${i.fix.code ? `data-code="${escapeHtml(i.fix.code)}"` : ""}>${i.fix.kind === "sync" ? "Sinkronkan" : `Pakai "${escapeHtml(i.fix.code)}"`}</button>` : ""}
                  </div>`).join("");
          return `
            <tr data-nohover>
              <td><strong>${escapeHtml(u.name || "(tanpa nama)")}</strong><div class="muted-sm">${roleLabel(u.role)}${u.email ? " · " + escapeHtml(u.email) : ""}</div></td>
              <td>${u.institusiId ? `<div class="mono-sm">${escapeHtml(u.institusiId)}</div><div class="muted-sm">${inst ? escapeHtml(inst.nama || "") : ""}</div>` : "—"}</td>
              <td>${kelasCell}</td>
              <td>${statusCell}</td>
              <td>${u.role === "admin" ? "" : `<button type="button" class="btn btn-ghost btn-small" data-edituser="${escapeHtml(u.uid)}">Ubah</button>`}</td>
            </tr>`;
        }).join("")}
      </tbody>
    </table>
    </div>
    ${total > USER_ROW_LIMIT ? `<p class="helptext" style="margin-top:10px;">Menampilkan ${USER_ROW_LIMIT} dari ${total} pengguna. Persempit dengan pencarian atau filter.</p>` : ""}
  `;
}

async function onUsersTableClick(e) {
  const fixBtn = e.target.closest("[data-fix]");
  if (fixBtn) {
    const u = USERS.find((x) => x.uid === fixBtn.dataset.uid);
    if (!u) return;
    fixBtn.disabled = true;
    try {
      if (fixBtn.dataset.fix === "sync") {
        await adminUpdateUser(u.uid, { kelasCodes: (u.kelasList || []).slice(0, 3).map((k) => k.kodeKelas) });
      } else if (fixBtn.dataset.fix === "usecode") {
        await adminUpdateUser(u.uid, { kelas: fixBtn.dataset.code });
      }
      await refreshAfterUserChange();
    } catch (err) {
      console.error(err);
      alert(`Gagal menyimpan: ${err.code || err.message}`);
      fixBtn.disabled = false;
    }
    return;
  }
  const editBtn = e.target.closest("[data-edituser]");
  if (editBtn) openEditUserModal(editBtn.dataset.edituser);
}

function dosenCodesInInstitution(instId) {
  const set = new Set();
  USERS.filter((d) => d.role === "dosen" && d.institusiId === instId)
    .forEach((d) => (Array.isArray(d.kelasCodes) ? d.kelasCodes : []).forEach((c) => set.add(c)));
  return [...set];
}

function openEditUserModal(uid) {
  const u = USERS.find((x) => x.uid === uid);
  if (!u) return;
  closeEditUserModal();

  const knownInst = INSTITUTIONS.some((i) => i.id === u.institusiId);
  const instOptions = [
    !u.institusiId ? `<option value="" selected>— belum ada —</option>` : "",
    u.institusiId && !knownInst ? `<option value="${escapeHtml(u.institusiId)}" selected>${escapeHtml(u.institusiId)} (tidak terdaftar)</option>` : "",
    ...INSTITUTIONS.map((i) => `<option value="${escapeHtml(i.id)}"${i.id === u.institusiId ? " selected" : ""}>${escapeHtml(i.nama || i.id)} (${escapeHtml(i.id)})</option>`)
  ].join("");

  const kelasRows = Array.isArray(u.kelasList) ? u.kelasList.slice(0, 3) : [];
  while (kelasRows.length < 3) kelasRows.push({ mataKuliah: "", kodeKelas: "" });

  const body = u.role === "mahasiswa"
    ? `
      <label for="editKelas">Kode kelas</label>
      <input type="text" id="editKelas" list="editKelasOptions" value="${escapeHtml(u.kelas || "")}" autocomplete="off">
      <datalist id="editKelasOptions"></datalist>
      <p class="helptext">Saran diambil dari kode kelas dosen di institusi yang dipilih. Harus persis sama (huruf besar/kecil dan tanda baca).</p>`
    : `
      <p class="helptext" style="margin-top:0;">Mata kuliah dan kode kelas dosen (maksimal 3). Kosongkan baris yang tidak dipakai.</p>
      ${kelasRows.map((k, i) => `
        <div class="field-row">
          <div><label for="editMk${i}">Mata kuliah ${i + 1}</label><input type="text" id="editMk${i}" value="${escapeHtml(k.mataKuliah || "")}"></div>
          <div><label for="editKode${i}">Kode kelas ${i + 1}</label><input type="text" id="editKode${i}" value="${escapeHtml(k.kodeKelas || "")}"></div>
        </div>`).join("")}`;

  const overlay = document.createElement("div");
  overlay.className = "modal-backdrop";
  overlay.id = "editUserModal";
  overlay.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true">
      <div class="card-head"><h2>Ubah pengguna</h2></div>
      <p class="helptext" style="margin-top:0;"><strong>${escapeHtml(u.name || "(tanpa nama)")}</strong> · ${roleLabel(u.role)}</p>
      <label for="editInst">Institusi</label>
      <select id="editInst">${instOptions}</select>
      ${body}
      <div class="modal-actions">
        <button type="button" class="btn btn-primary" id="saveUserBtn">Simpan</button>
        <button type="button" class="btn btn-ghost" id="cancelUserBtn">Batal</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const fillOptions = () => {
    const list = document.getElementById("editKelasOptions");
    if (!list) return;
    const instId = document.getElementById("editInst").value;
    list.innerHTML = dosenCodesInInstitution(instId).map((c) => `<option value="${escapeHtml(c)}"></option>`).join("");
  };
  fillOptions();
  document.getElementById("editInst").addEventListener("change", fillOptions);
  document.getElementById("cancelUserBtn").addEventListener("click", closeEditUserModal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeEditUserModal(); });
  document.getElementById("saveUserBtn").addEventListener("click", () => saveEditUser(u));
}

function closeEditUserModal() {
  const el = document.getElementById("editUserModal");
  if (el) el.remove();
}

async function saveEditUser(u) {
  const fields = {};
  const instVal = document.getElementById("editInst").value;

  if (instVal && instVal !== (u.institusiId || "")) {
    const msg = u.role === "dosen"
      ? `Pindahkan dosen ini ke institusi "${instVal}"? Mahasiswa di institusi lama tidak akan lagi terhubung dengannya.`
      : `Pindahkan mahasiswa ini ke institusi "${instVal}"?`;
    if (!confirm(msg)) return;
    fields.institusiId = instVal;
  }

  if (u.role === "mahasiswa") {
    const kelasVal = document.getElementById("editKelas").value.trim();
    if (kelasVal !== (u.kelas || "")) fields.kelas = kelasVal || null;
  } else if (u.role === "dosen") {
    const rows = [0, 1, 2]
      .map((i) => ({
        mataKuliah: document.getElementById(`editMk${i}`).value.trim(),
        kodeKelas: document.getElementById(`editKode${i}`).value.trim()
      }))
      .filter((r) => r.mataKuliah || r.kodeKelas);

    if (rows.some((r) => !r.mataKuliah || !r.kodeKelas)) {
      alert("Setiap baris harus punya mata kuliah dan kode kelas, atau dikosongkan seluruhnya.");
      return;
    }
    const lower = rows.map((r) => r.kodeKelas.toLowerCase());
    if (new Set(lower).size !== lower.length) {
      alert("Ada kode kelas yang dobel.");
      return;
    }
    const before = JSON.stringify((u.kelasList || []).map((k) => [k.mataKuliah, k.kodeKelas]));
    const after = JSON.stringify(rows.map((r) => [r.mataKuliah, r.kodeKelas]));
    const codesBefore = JSON.stringify(u.kelasCodes || []);
    const codesAfter = JSON.stringify(rows.map((r) => r.kodeKelas));
    if (before !== after || codesBefore !== codesAfter) {
      fields.kelasList = rows;
      fields.kelasCodes = rows.map((r) => r.kodeKelas);
    }
  }

  if (Object.keys(fields).length === 0) {
    closeEditUserModal();
    return;
  }

  const btn = document.getElementById("saveUserBtn");
  btn.disabled = true;
  btn.textContent = "Menyimpan…";
  try {
    await adminUpdateUser(u.uid, fields);
    closeEditUserModal();
    await refreshAfterUserChange();
  } catch (err) {
    console.error(err);
    alert(`Gagal menyimpan: ${err.code || err.message}`);
    btn.disabled = false;
    btn.textContent = "Simpan";
  }
}
