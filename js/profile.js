import { requireAuth, logout, blockIfInstitutionInactive } from "./authGuard.js";
import { getUserProfile, updateUserProfileFields, updateDosenKelasList, getTasks } from "./firestore.js";
import { escapeHtml, computeCombinedRisk, RISK_COPY } from "./utils.js";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

const root = document.getElementById("root");
document.getElementById("logoutBtn").addEventListener("click", logout);

let CURRENT_USER = null;
let PROFILE = null;
let TASKS = [];
let kelasEditDraft = [{ mataKuliah: "", kodeKelas: "" }];

requireAuth(async (user) => {
  CURRENT_USER = user;
  PROFILE = await getUserProfile(user.uid);
  if (await blockIfInstitutionInactive(root, PROFILE)) return;

  document.getElementById("userGreeting").textContent = `${PROFILE.name} · ${PROFILE.role === "dosen" ? "Dosen" : "Mahasiswa"}`;

  if (PROFILE.role === "mahasiswa") {
    TASKS = await getTasks(user.uid);
  } else if (PROFILE.kelasList && PROFILE.kelasList.length > 0) {
    kelasEditDraft = PROFILE.kelasList.map((k) => ({ ...k }));
  }

  render();
});

function render() {
  const isDosen = PROFILE.role === "dosen";
  const combinedRisk = PROFILE.assessmentDone ? computeCombinedRisk(PROFILE.assessmentScore, TASKS) : null;

  root.innerHTML = `
    <div class="card">
      <div class="card-head"><h2>Akun</h2></div>
      <div class="profile-row"><span class="k">Nama Lengkap</span><span class="v">${escapeHtml(PROFILE.name)}</span></div>
      <div class="profile-row"><span class="k">Email</span><span class="v">${escapeHtml(PROFILE.email)}</span></div>
      <div class="profile-row"><span class="k">Status</span><span class="v">${isDosen ? "Dosen" : "Mahasiswa"}</span></div>

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
      ` : `
        <label for="kelasInput">Kode Kelas</label>
        <input type="text" id="kelasInput" value="${escapeHtml(PROFILE.kelas || "")}">
      `}

      <button class="btn btn-primary" id="saveBtn">Simpan Perubahan</button>
      <span id="saveStatus" style="margin-left:10px;font-size:12.5px;color:var(--moss-2);display:none;">Tersimpan.</span>
    </div>

    ${isDosen ? `
      <div class="card">
        <div class="card-head"><h2>Mata Kuliah yang Diampu</h2><span class="tag">Maks. 3</span></div>
        <p class="helptext" style="margin-top:0;">Tiap mata kuliah punya kode kelas sendiri — mahasiswa yang mendaftar dengan kode itu akan muncul di dashboard-mu.</p>

        ${kelasEditDraft.map((row, i) => `
          <div class="field-row" data-row="${i}" style="align-items:flex-end;">
            <div>
              <label for="mataKuliah${i}">Mata Kuliah ${i + 1}</label>
              <input type="text" id="mataKuliah${i}" placeholder="Contoh: Basis Data" value="${escapeHtml(row.mataKuliah)}">
            </div>
            <div style="display:flex;gap:8px;align-items:flex-start;">
              <div style="flex:1;">
                <label for="kodeKelas${i}">Kode Kelas ${i + 1}</label>
                <input type="text" id="kodeKelas${i}" placeholder="Contoh: RPL-A-2026" value="${escapeHtml(row.kodeKelas)}">
              </div>
              ${kelasEditDraft.length > 1 ? `<button type="button" class="ledger-delete" data-removekelasrow="${i}" title="Hapus baris" style="margin-top:30px;">✕</button>` : ""}
            </div>
          </div>
        `).join("")}

        ${kelasEditDraft.length < 3 ? `<button type="button" class="btn btn-ghost btn-small" id="addKelasRowBtn">+ Tambah Mata Kuliah</button>` : `<p class="note">Sudah maksimal 3 mata kuliah.</p>`}

        <button class="btn btn-primary" id="saveKelasListBtn" style="width:100%;margin-top:16px;">Simpan Mata Kuliah</button>
        <span id="saveKelasStatus" style="margin-left:10px;font-size:12.5px;color:var(--moss-2);display:none;">Tersimpan.</span>
      </div>
    ` : ""}

    ${!isDosen ? `
      <div class="card">
        <div class="card-head"><h2>Neraca Kemandirian</h2></div>
        ${PROFILE.assessmentDone
          ? `<div class="profile-row"><span class="k">Status Neraca Kemandirian</span><span class="v">${RISK_COPY[combinedRisk.level].label}</span></div>
             <div class="profile-row"><span class="k">Skor Kuis</span><span class="v">${PROFILE.assessmentScore}/21</span></div>
             <p class="helptext" style="margin-top:10px;">Status ini sudah digabung dengan pola tugasmu minggu ini, sama seperti yang tampil di dashboard.</p>
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
    if (!name) {
      alert("Nama tidak boleh kosong.");
      return;
    }
    const btn = document.getElementById("saveBtn");
    btn.disabled = true;
    btn.textContent = "Menyimpan…";

    const fields = { name };
    if (PROFILE.role === "dosen") {
      fields.nip = document.getElementById("nipInput").value.trim() || null;
    } else {
      fields.kelas = document.getElementById("kelasInput").value.trim() || null;
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

  // ===== Mata kuliah dosen (maks 3) =====
  kelasEditDraft.forEach((_, i) => {
    const mkEl = document.getElementById(`mataKuliah${i}`);
    const kkEl = document.getElementById(`kodeKelas${i}`);
    if (mkEl) mkEl.addEventListener("input", (e) => (kelasEditDraft[i].mataKuliah = e.target.value));
    if (kkEl) kkEl.addEventListener("input", (e) => (kelasEditDraft[i].kodeKelas = e.target.value));
  });

  const addKelasRowBtn = document.getElementById("addKelasRowBtn");
  if (addKelasRowBtn) {
    addKelasRowBtn.addEventListener("click", () => {
      if (kelasEditDraft.length < 3) kelasEditDraft.push({ mataKuliah: "", kodeKelas: "" });
      render();
    });
  }

  document.querySelectorAll("[data-removekelasrow]").forEach((btn) => {
    btn.addEventListener("click", () => {
      kelasEditDraft.splice(Number(btn.dataset.removekelasrow), 1);
      if (kelasEditDraft.length === 0) kelasEditDraft.push({ mataKuliah: "", kodeKelas: "" });
      render();
    });
  });

  const saveKelasListBtn = document.getElementById("saveKelasListBtn");
  if (saveKelasListBtn) {
    saveKelasListBtn.addEventListener("click", async () => {
      const filled = kelasEditDraft
        .map((r) => ({ mataKuliah: r.mataKuliah.trim(), kodeKelas: r.kodeKelas.trim() }))
        .filter((r) => r.mataKuliah && r.kodeKelas);

      if (filled.length === 0) {
        alert("Isi minimal satu mata kuliah beserta kode kelasnya.");
        return;
      }

      saveKelasListBtn.disabled = true;
      saveKelasListBtn.textContent = "Menyimpan…";

      await updateDosenKelasList(CURRENT_USER.uid, filled);
      PROFILE.kelasList = filled;
      PROFILE.kelasCodes = filled.map((r) => r.kodeKelas);

      saveKelasListBtn.disabled = false;
      saveKelasListBtn.textContent = "Simpan Mata Kuliah";
      const status = document.getElementById("saveKelasStatus");
      status.style.display = "inline";
      setTimeout(() => (status.style.display = "none"), 2000);
    });
  }
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
