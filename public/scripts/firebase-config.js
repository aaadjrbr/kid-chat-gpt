// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getAuth, sendEmailVerification, sendPasswordResetEmail, signInWithPopup, applyActionCode, verifyPasswordResetCode, confirmPasswordReset } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-storage.js"; // Import Firebase Storage
import { getFunctions } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-functions.js"; // Import Functions

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyDKhZZs3zN4AsRrv11YflMuj5MDasA6s0A",
    authDomain: "kids-chatgpt.firebaseapp.com",
    projectId: "kids-chatgpt",
    storageBucket: "kids-chatgpt.appspot.com",
    messagingSenderId: "432328053093",
    appId: "1:432328053093:web:59725efb514e0518cd918c",
    measurementId: "G-3XSXSF20Y3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app); // Export storage reference
export const functions = getFunctions(app); // Export Functions

// Export auth functions for use in other parts of your app
export { sendEmailVerification, sendPasswordResetEmail, signInWithPopup, applyActionCode, verifyPasswordResetCode, confirmPasswordReset };
