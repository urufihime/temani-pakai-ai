import { auth } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

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
