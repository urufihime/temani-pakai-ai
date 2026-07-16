import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

console.log("✅ auth.js berhasil dimuat");

// Ambil elemen dari halaman
const loginBtn = document.getElementById("loginBtn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorDiv = document.getElementById("error");

// Saat tombol login diklik
loginBtn.addEventListener("click", async () => {

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    errorDiv.textContent = "";

    try {

        const userCredential = await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        console.log("✅ Login berhasil");
        console.log(userCredential.user);

        // sementara tampilkan alert
        alert("Login berhasil!");

        // Nanti kita arahkan ke dashboard
        // window.location.href = "dashboard.html";

    } catch (error) {

        console.error(error);

        errorDiv.textContent = "Email atau password salah.";

    }

});
