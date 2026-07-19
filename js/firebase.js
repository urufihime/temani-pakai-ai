// Firebase App
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";

// Authentication
import { getAuth } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// Firestore
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBuMpRtL-3_RO5qKxgrTkkBlUqWcUOMm2c",
  authDomain: "temani-pakai-ai-fe0cb.firebaseapp.com",
  projectId: "temani-pakai-ai-fe0cb",
  storageBucket: "temani-pakai-ai-fe0cb.firebasestorage.app",
  messagingSenderId: "713897368685",
  appId: "1:713897368685:web:5a77ddbc9973bdd8c73364"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

>>>>>>> c0ec796a2f7ebc9cbfedc4a423c5e9bf28aee74f
console.log("✅ Firebase berhasil dimuat");