import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { createUserProfile, getInstitution, getUserProfile } from "./firestore.js";

/* ============================================================
   Helper tampilkan error dalam bentuk banner
   ============================================================ */
const errorDiv = document.getElementById("error");

function showError(message) {
  if (!errorDiv) return;
  errorDiv.textContent = message;
  errorDiv.classList.add("show");
}

function clearError() {
  if (!errorDiv) return;
  errorDiv.textContent = "";
  errorDiv.classList.remove("show");
}

// Terjemahkan kode error Firebase Auth ke pesan berbahasa Indonesia
function translateAuthError(error) {
  const map = {
    "auth/invalid-email": "Format email tidak valid.",
    "auth/user-disabled": "Akun ini dinonaktifkan.",
    "auth/user-not-found": "Email atau password salah.",
    "auth/wrong-password": "Email atau password salah.",
    "auth/invalid-credential": "Email atau password salah.",
    "auth/email-already-in-use": "Email ini sudah terdaftar. Coba masuk saja.",
    "auth/weak-password": "Password minimal 6 karakter.",
    "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi sebentar lagi.",
    "auth/missing-email": "Masukkan email dulu."
  };
  return map[error.code] || "Terjadi kesalahan. Silakan coba lagi.";
}

function setLoading(button, isLoading, loadingText, normalText) {
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingText : normalText;
}

/* ============================================================
   LOGIN (login.html)
   ============================================================ */
const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const loginBtn = document.getElementById("loginBtn");

    setLoading(loginBtn, true, "Memproses…", "Masuk");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const profile = await getUserProfile(userCredential.user.uid);
      window.location.href = profile && profile.role === "admin" ? "admin.html" : "dashboard.html";
    } catch (error) {
      console.error(error);
      showError(translateAuthError(error));
      setLoading(loginBtn, false, "Memproses…", "Masuk");
    }
  });
}

/* ============================================================
   LUPA PASSWORD (login.html)
   ============================================================ */
const loginView = document.getElementById("loginView");
const resetView = document.getElementById("resetView");
const forgotPasswordLink = document.getElementById("forgotPasswordLink");
const backToLoginLink = document.getElementById("backToLoginLink");
const resetForm = document.getElementById("resetForm");
const resetMessage = document.getElementById("resetMessage");

function showResetMessage(message, isSuccess) {
  if (!resetMessage) return;
  resetMessage.textContent = message;
  resetMessage.classList.remove("banner-error", "banner-success");
  resetMessage.classList.add(isSuccess ? "banner-success" : "banner-error", "show");
}

function clearResetMessage() {
  if (!resetMessage) return;
  resetMessage.textContent = "";
  resetMessage.classList.remove("show", "banner-error", "banner-success");
}

if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener("click", (e) => {
    e.preventDefault();
    clearError();
    clearResetMessage();
    loginView.style.display = "none";
    resetView.style.display = "block";
  });
}

if (backToLoginLink) {
  backToLoginLink.addEventListener("click", (e) => {
    e.preventDefault();
    clearResetMessage();
    resetView.style.display = "none";
    loginView.style.display = "block";
  });
}

if (resetForm) {
  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearResetMessage();

    const email = document.getElementById("resetEmail").value.trim();
    const resetBtn = document.getElementById("resetBtn");

    setLoading(resetBtn, true, "Mengirim…", "Kirim Link Reset");

    try {
      await sendPasswordResetEmail(auth, email);
      showResetMessage(
        `Link reset password sudah dikirim ke ${email}. Cek inbox (dan folder spam) lalu ikuti instruksinya.`,
        true
      );
      resetForm.reset();
    } catch (error) {
      console.error(error);
      const message = error.code === "auth/user-not-found"
        ? "Email ini belum terdaftar. Periksa lagi atau daftar akun baru."
        : translateAuthError(error);
      showResetMessage(message, false);
    } finally {
      setLoading(resetBtn, false, "Mengirim…", "Kirim Link Reset");
    }
  });
}
/* ============================================================
   REGISTER (register.html)
   ============================================================ */
const registerForm = document.getElementById("registerForm");

if (registerForm) {
  // Interaksi pilihan peran (pill mahasiswa/dosen)
  const rolePillset = document.getElementById("rolePillset");
  const roleInput = document.getElementById("role");

  if (rolePillset) {
    rolePillset.addEventListener("click", (e) => {
      const pill = e.target.closest(".pill");
      if (!pill) return;
      rolePillset.querySelectorAll(".pill").forEach((p) => {
        p.dataset.active = "false";
        p.setAttribute("aria-checked", "false");
      });
      pill.dataset.active = "true";
      pill.setAttribute("aria-checked", "true");
      roleInput.value = pill.dataset.role;
    });
  }

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    const name = document.getElementById("name").value.trim();
    const institusiId = document.getElementById("institusiId").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const role = roleInput.value;
    const registerBtn = document.getElementById("registerBtn");

    if (password !== confirmPassword) {
      showError("Konfirmasi password tidak cocok.");
      return;
    }
    if (!name) {
      showError("Nama lengkap tidak boleh kosong.");
      return;
    }
    if (!institusiId) {
      showError("Kode institusi tidak boleh kosong. Minta kode ini ke admin institusimu.");
      return;
    }

    setLoading(registerBtn, true, "Memproses…", "Daftar");

    try {
      // Validasi kode institusi dulu SEBELUM bikin akun Firebase Auth,
      // supaya tidak ada akun "nyangkut" tanpa institusi yang valid.
      const inst = await getInstitution(institusiId);
      const today = new Date().toISOString().slice(0, 10);
      const instActive = inst && inst.status === "aktif" && (!inst.expiresAt || inst.expiresAt >= today);

      if (!inst) {
        showError("Kode institusi tidak ditemukan. Periksa lagi kode dari admin institusimu.");
        setLoading(registerBtn, false, "Memproses…", "Daftar");
        return;
      }
      if (!instActive) {
        showError("Institusi ini belum aktif atau langganannya sudah berakhir. Hubungi admin institusimu.");
        setLoading(registerBtn, false, "Memproses…", "Daftar");
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      await createUserProfile(userCredential.user.uid, { name, email, role, institusiId });

      window.location.href = "dashboard.html";
    } catch (error) {
      console.error(error);
      showError(translateAuthError(error));
      setLoading(registerBtn, false, "Memproses…", "Daftar");
    }
  });
}
