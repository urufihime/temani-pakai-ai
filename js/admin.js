import { requireAuth, logout } from "./authGuard.js";
import {
  getUserProfile,
  getAllInstitutions,
  createInstitution,
  updateInstitution,
  deleteInstitution,
  countUsersInInstitution,
  getInstitution
} from "./firestore.js";
import { escapeHtml, todayStr } from "./utils.js";

const root = document.getElementById("root");
document.getElementById("logoutBtn").addEventListener("click", logout);

let ME = null;
let INSTITUTIONS = [];
let newInstDraft = { kode: "", nama: "", expiresAt: "", catatan: "" };

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
  render();
});

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
}

function bindEvents() {
  document.getElementById("instKode").addEventListener("input", (e) => (newInstDraft.kode = e.target.value));
  document.getElementById("instNama").addEventListener("input", (e) => (newInstDraft.nama = e.target.value));
  document.getElementById("instExpires").addEventListener("input", (e) => (newInstDraft.expiresAt = e.target.value));
  document.getElementById("instCatatan").addEventListener("input", (e) => (newInstDraft.catatan = e.target.value));

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
