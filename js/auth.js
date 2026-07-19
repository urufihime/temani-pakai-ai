import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { createUserProfile } from "./firestore.js";

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
    "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi sebentar lagi."
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
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "dashboard.html";
    } catch (error) {
      console.error(error);
      showError(translateAuthError(error));
      setLoading(loginBtn, false, "Memproses…", "Masuk");
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
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const role = roleInput.value;
    const registerBtn = document.getElementById("registerBtn");

    if (password !== confirmPassword) {
      showError("Konfirmasi password tidak cocok.");
      return;
    }

    setLoading(registerBtn, true, "Memproses…", "Daftar");

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      await createUserProfile(userCredential.user.uid, { name, email, role });

      window.location.href = "dashboard.html";
    } catch (error) {
      console.error(error);
      showError(translateAuthError(error));
      setLoading(registerBtn, false, "Memproses…", "Daftar");
    }
  });
}
