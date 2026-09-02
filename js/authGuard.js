import { auth } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getInstitution } from "./firestore.js";

/**
 * Panggil di halaman yang butuh login (dashboard, assessment, profile, history).
 * onReady(user) dipanggil sekali user dipastikan sudah login.
 * Kalau belum login, otomatis redirect ke login.html.
 */
export function requireAuth(onReady) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    onReady(user);
  });
}

export async function logout() {
  await signOut(auth);
  window.location.href = "login.html";
}

/**
 * Cek status langganan institusi pemilik akun (model SaaS multi-institusi).
 * Kalau institusi nonaktif/kadaluarsa, tampilkan blok akses di dalam `root`
 * dan return true (halaman pemanggil harus berhenti render lanjutannya).
 * Akun lama tanpa institusiId (dibuat sebelum fitur ini) tetap diizinkan lewat.
 */
export async function blockIfInstitutionInactive(root, profile) {
  if (!profile.institusiId) return false;

  const inst = await getInstitution(profile.institusiId);
  const today = new Date().toISOString().slice(0, 10);
  const active = inst && inst.status === "aktif" && (!inst.expiresAt || inst.expiresAt >= today);

  if (!active) {
    root.innerHTML = `
      <div class="card">
        <p class="empty">Langganan institusi kamu sudah tidak aktif atau sudah berakhir. Hubungi admin institusimu untuk memperpanjang akses.</p>
        <button class="btn btn-primary" id="logoutBtnBlock">Keluar</button>
      </div>
    `;
    document.getElementById("logoutBtnBlock").addEventListener("click", logout);
    return true;
  }
  return false;
}
