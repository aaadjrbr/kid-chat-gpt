import { auth } from './firebase-config.js';
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";

// Elements
const loginForm = document.getElementById('login-form');
const createAccountForm = document.getElementById('create-account-form');
const passwordResetForm = document.getElementById('password-reset-form');
const toggleCreateAccountButton = document.getElementById('toggle-create-account');
const forgotPasswordLink = document.getElementById('forgot-password-link');
const Iremember = document.getElementById('i-remember');
const errorMessage = document.getElementById('error-message');
const createErrorMessage = document.getElementById('create-error-message');
const resetErrorMessage = document.getElementById('reset-error-message');
const resetSuccessMessage = document.getElementById('reset-success-message');

// Toggle visibility of Create Account form
toggleCreateAccountButton.addEventListener('click', () => {
    createAccountForm.style.display = createAccountForm.style.display === 'none' ? 'block' : 'none';
});

// Handle login form submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm['email'].value;
    const password = loginForm['password'].value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (user.emailVerified) {
            window.location.href = 'profiles.html';  // Proceed if email is verified
        } else {
            errorMessage.textContent = "Please verify your email before logging in.";
            errorMessage.style.display = 'block';
        }
    } catch (error) {
        errorMessage.textContent = "Login failed. Please check your credentials.";
        errorMessage.style.display = 'block';
    }
});

// Google Sign-In
const googleProvider = new GoogleAuthProvider();

document.getElementById('google-login-btn').addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        window.location.href = 'profiles.html';  // Redirect after login
    } catch (error) {
        console.error("Google sign-in failed:", error);
        errorMessage.textContent = "Google sign-in failed. Please try again.";
        errorMessage.style.display = 'block';
    }
});

// Handle Create Account form submission and send email verification
createAccountForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newEmail = createAccountForm['new-email'].value;
    const newPassword = createAccountForm['new-account-password'].value;
    const confirmPassword = createAccountForm['confirm-account-password'].value;
    const termsCheckbox = document.getElementById('agreeTerms');

    // Check if passwords match
    if (newPassword !== confirmPassword) {
        createErrorMessage.textContent = "Passwords do not match.";
        createErrorMessage.style.display = 'block';
        return;
    }

    // Check if the terms checkbox is checked
    if (!termsCheckbox.checked) {
        createErrorMessage.textContent = "You must agree to the Terms of Service.";
        createErrorMessage.style.display = 'block';
        return;
    }

    try {
        // Create user account
        const userCredential = await createUserWithEmailAndPassword(auth, newEmail, newPassword);
        const user = userCredential.user;

        // Send email verification
        await sendEmailVerification(user);

        createErrorMessage.textContent = "Account created! Please check your email to verify your account before logging in.";
        createErrorMessage.style.display = 'block';

    } catch (error) {
        createErrorMessage.textContent = "Account creation failed. Please try again.";
        createErrorMessage.style.display = 'block';
    }
});

// Handle password reset
forgotPasswordLink.addEventListener('click', () => {
    passwordResetForm.style.display = 'block';
    loginForm.style.display = 'none';
    createAccountForm.style.display = 'none';
});

Iremember.addEventListener('click', () => {
    passwordResetForm.style.display = 'none';
    loginForm.style.display = 'block';
    createAccountForm.style.display = 'none';
});

passwordResetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const resetEmail = passwordResetForm['reset-email'].value;

    try {
        await sendPasswordResetEmail(auth, resetEmail);
        resetSuccessMessage.textContent = "Password reset email sent. Please check your inbox.";
        resetSuccessMessage.style.display = 'block';
        resetErrorMessage.style.display = 'none';
    } catch (error) {
        resetErrorMessage.textContent = "Failed to send reset email. Please try again.";
        resetErrorMessage.style.display = 'block';
        resetSuccessMessage.style.display = 'none';
    }
});

// Password visibility toggle
document.querySelectorAll('.toggle-password').forEach(togglePassword => {
    togglePassword.addEventListener('click', () => {
        const passwordField = togglePassword.previousElementSibling;
        const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordField.setAttribute('type', type);
        togglePassword.textContent = type === 'password' ? '👀' : '🙈';
    });
});
