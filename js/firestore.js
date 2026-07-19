import { db } from "./firebase.js";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

/**
 * Buat dokumen profil pengguna baru di koleksi "users".
 * Dipanggil sekali saat registrasi berhasil.
 */
export async function createUserProfile(uid, { name, email, role }) {
  await setDoc(doc(db, "users", uid), {
    name,
    email,
    role,        // "mahasiswa" | "dosen"
    kelas: null, // diisi belakangan dari dashboard (kode kelas)
    createdAt: serverTimestamp()
  });
}

/**
 * Ambil profil pengguna dari koleksi "users" berdasarkan uid.
 * Mengembalikan null kalau belum ada dokumennya.
 */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}
