import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-functions.js"; // Import getFunctions

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
const db = getFirestore(app);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const functions = getFunctions(app); // Initialize Firebase Functions

export { db, auth, functions }; // Export functions
