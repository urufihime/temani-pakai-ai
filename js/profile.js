import { requireAuth, logout } from "./authGuard.js";
import { getUserProfile, updateUserProfileFields } from "./firestore.js";
import { escapeHtml, RISK_COPY } from "./utils.js";

const root = document.getElementById("root");
document.getElementById("logoutBtn").addEventListener("click", logout);

let CURRENT_USER = null;
let PROFILE = null;

requireAuth(async (user) => {
  CURRENT_USER = user;
  PROFILE = await getUserProfile(user.uid);
  document.getElementById("userGreeting").textContent = `${PROFILE.name} · ${PROFILE.role === "dosen" ? "Dosen" : "Mahasiswa"}`;
  render();
});

function render() {
  const isDosen = PROFILE.role === "dosen";
  const assessmentCopy = PROFILE.assessmentDone ? RISK_COPY[PROFILE.assessmentLevel] : null;

  root.innerHTML = `
    <div class="card">
      <div class="card-head"><h2>Akun</h2></div>
      <div class="profile-row"><span class="k">Email</span><span class="v">${escapeHtml(PROFILE.email)}</span></div>
      <div class="profile-row"><span class="k">Peran</span><span class="v">${isDosen ? "Dosen" : "Mahasiswa"}</span></div>
    </div>

    <div class="card">
      <div class="card-head"><h2>Edit Profil</h2></div>
      <label for="nameInput">Nama Lengkap</label>
      <input type="text" id="nameInput" value="${escapeHtml(PROFILE.name)}">

      <label for="kelasInput">${isDosen ? "Kelas yang Diampu" : "Kode Kelas"}</label>
      <input type="text" id="kelasInput" value="${escapeHtml(PROFILE.kelas || "")}">

      <button class="btn btn-primary" id="saveBtn">Simpan Perubahan</button>
      <span id="saveStatus" style="margin-left:10px;font-size:12.5px;color:var(--moss-2);display:none;">Tersimpan.</span>
    </div>

    ${!isDosen ? `
      <div class="card">
        <div class="card-head"><h2>Neraca Kemandirian</h2></div>
        ${PROFILE.assessmentDone
          ? `<div class="profile-row"><span class="k">Hasil Terakhir</span><span class="v">${assessmentCopy.label} (${PROFILE.assessmentScore}/100)</span></div>
             <a href="assessment.html" class="btn btn-ghost btn-small" style="text-decoration:none;display:inline-block;margin-top:12px;">Isi Ulang Asesmen</a>`
          : `<p class="empty">Belum diisi.</p>
             <a href="assessment.html" class="btn btn-primary" style="text-decoration:none;display:inline-block;">Isi Sekarang</a>`
        }
      </div>
    ` : ""}
  `;

  document.getElementById("saveBtn").addEventListener("click", async () => {
    const name = document.getElementById("nameInput").value.trim();
    const kelas = document.getElementById("kelasInput").value.trim();
    if (!name) {
      alert("Nama tidak boleh kosong.");
      return;
    }
    const btn = document.getElementById("saveBtn");
    btn.disabled = true;
    btn.textContent = "Menyimpan…";

    await updateUserProfileFields(CURRENT_USER.uid, { name, kelas: kelas || null });
    PROFILE.name = name;
    PROFILE.kelas = kelas || null;
    document.getElementById("userGreeting").textContent = `${PROFILE.name} · ${PROFILE.role === "dosen" ? "Dosen" : "Mahasiswa"}`;

    btn.disabled = false;
    btn.textContent = "Simpan Perubahan";
    const status = document.getElementById("saveStatus");
    status.style.display = "inline";
    setTimeout(() => (status.style.display = "none"), 2000);
  });
}
