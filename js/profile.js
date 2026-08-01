import { requireAuth, logout } from "./authGuard.js";
import { getUserProfile, updateUserProfileFields } from "./firestore.js";
import { escapeHtml, QUIZ_LEVEL_COPY } from "./utils.js";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

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
  const assessmentCopy = PROFILE.assessmentDone ? QUIZ_LEVEL_COPY[PROFILE.assessmentLevel] : null;

  root.innerHTML = `
    <div class="card">
      <div class="card-head"><h2>Akun</h2></div>
      <div class="profile-row"><span class="k">Email</span><span class="v">${escapeHtml(PROFILE.email)}</span></div>
      <div class="profile-row"><span class="k">Peran</span><span class="v">${isDosen ? "Dosen" : "Mahasiswa"}</span></div>

      <div id="passwordMessage" class="banner auth-error" style="display:none;margin-top:16px;"></div>

      <label for="currentPasswordInput" style="margin-top:16px;">Password Saat Ini</label>
      <input type="password" id="currentPasswordInput" autocomplete="current-password">

      <label for="newPasswordInput">Password Baru</label>
      <input type="password" id="newPasswordInput" placeholder="Minimal 6 karakter" autocomplete="new-password">

      <label for="confirmNewPasswordInput">Konfirmasi Password Baru</label>
      <input type="password" id="confirmNewPasswordInput" autocomplete="new-password">

      <button class="btn btn-primary" id="changePasswordBtn">Ubah Password</button>
    </div>

    <div class="card">
      <div class="card-head"><h2>Edit Profil</h2></div>
      <label for="nameInput">Nama Lengkap</label>
      <input type="text" id="nameInput" value="${escapeHtml(PROFILE.name)}">

      ${isDosen ? `
        <label for="nipInput">NIP / NIDN</label>
        <input type="text" id="nipInput" placeholder="Opsional" value="${escapeHtml(PROFILE.nip || "")}">

        <label for="mataKuliahInput">Mata Kuliah yang Diampu</label>
        <input type="text" id="mataKuliahInput" placeholder="Contoh: Basis Data, Pemrograman Web" value="${escapeHtml(PROFILE.mataKuliah || "")}">
      ` : ""}

      <label for="kelasInput">${isDosen ? "Kode Kelas yang Diampu" : "Kode Kelas"}</label>
      <input type="text" id="kelasInput" value="${escapeHtml(PROFILE.kelas || "")}">
      ${isDosen ? `<p class="helptext">Kode ini yang dipakai mahasiswa untuk terhubung ke kelasmu — beda dengan nama mata kuliah di atas.</p>` : ""}

      <button class="btn btn-primary" id="saveBtn">Simpan Perubahan</button>
      <span id="saveStatus" style="margin-left:10px;font-size:12.5px;color:var(--moss-2);display:none;">Tersimpan.</span>
    </div>

    ${!isDosen ? `
      <div class="card">
        <div class="card-head"><h2>Neraca Kemandirian</h2></div>
        ${PROFILE.assessmentDone
          ? `<div class="profile-row"><span class="k">Hasil Terakhir</span><span class="v">${assessmentCopy.label} (${PROFILE.assessmentScore}/21)</span></div>
             <a href="assessment.html" class="btn btn-ghost btn-small" style="text-decoration:none;display:inline-block;margin-top:12px;">Isi Ulang Asesmen</a>`
          : `<p class="empty">Belum diisi.</p>
             <a href="assessment.html" class="btn btn-primary" style="text-decoration:none;display:inline-block;">Isi Sekarang</a>`
        }
      </div>
    ` : ""}
  `;

  bindEvents();
}

function bindEvents() {
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

    const fields = { name, kelas: kelas || null };
    if (PROFILE.role === "dosen") {
      fields.nip = document.getElementById("nipInput").value.trim() || null;
      fields.mataKuliah = document.getElementById("mataKuliahInput").value.trim() || null;
    }

    await updateUserProfileFields(CURRENT_USER.uid, fields);
    Object.assign(PROFILE, fields);
    document.getElementById("userGreeting").textContent = `${PROFILE.name} · ${PROFILE.role === "dosen" ? "Dosen" : "Mahasiswa"}`;

    btn.disabled = false;
    btn.textContent = "Simpan Perubahan";
    const status = document.getElementById("saveStatus");
    status.style.display = "inline";
    setTimeout(() => (status.style.display = "none"), 2000);
  });

  document.getElementById("changePasswordBtn").addEventListener("click", handleChangePassword);
}

function showPasswordMessage(message, isSuccess) {
  const box = document.getElementById("passwordMessage");
  box.textContent = message;
  box.classList.remove("banner-error", "banner-success");
  box.classList.add(isSuccess ? "banner-success" : "banner-error");
  box.style.display = "block";
}

function translatePasswordError(error) {
  const map = {
    "auth/wrong-password": "Password saat ini salah.",
    "auth/invalid-credential": "Password saat ini salah.",
    "auth/weak-password": "Password baru minimal 6 karakter.",
    "auth/requires-recent-login": "Sesi login sudah terlalu lama. Silakan keluar dan masuk ulang, lalu coba lagi.",
    "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi sebentar lagi."
  };
  return map[error.code] || "Gagal mengubah password. Coba lagi.";
}

async function handleChangePassword() {
  const currentPassword = document.getElementById("currentPasswordInput").value;
  const newPassword = document.getElementById("newPasswordInput").value;
  const confirmNewPassword = document.getElementById("confirmNewPasswordInput").value;
  const btn = document.getElementById("changePasswordBtn");

  if (!currentPassword || !newPassword || !confirmNewPassword) {
    showPasswordMessage("Isi semua kolom password dulu.", false);
    return;
  }
  if (newPassword.length < 6) {
    showPasswordMessage("Password baru minimal 6 karakter.", false);
    return;
  }
  if (newPassword !== confirmNewPassword) {
    showPasswordMessage("Konfirmasi password baru tidak cocok.", false);
    return;
  }

  btn.disabled = true;
  btn.textContent = "Memproses…";

  try {
    const credential = EmailAuthProvider.credential(CURRENT_USER.email, currentPassword);
    await reauthenticateWithCredential(CURRENT_USER, credential);
    await updatePassword(CURRENT_USER, newPassword);

    showPasswordMessage("Password berhasil diubah.", true);
    document.getElementById("currentPasswordInput").value = "";
    document.getElementById("newPasswordInput").value = "";
    document.getElementById("confirmNewPasswordInput").value = "";
  } catch (error) {
    console.error(error);
    showPasswordMessage(translatePasswordError(error), false);
  } finally {
    btn.disabled = false;
    btn.textContent = "Ubah Password";
  }
}
