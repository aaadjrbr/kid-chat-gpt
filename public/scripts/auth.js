// auth.js
import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";

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
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = 'profiles.html';
    } catch (error) {
        errorMessage.textContent = "Login failed. Please check your credentials.";
        errorMessage.style.display = 'block';
    }
});

// Handle Create Account form submission
createAccountForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newEmail = createAccountForm['new-email'].value;
    const newPassword = createAccountForm['new-account-password'].value;
    const confirmPassword = createAccountForm['confirm-account-password'].value;

    if (newPassword !== confirmPassword) {
        createErrorMessage.textContent = "Passwords do not match.";
        createErrorMessage.style.display = 'block';
        return;
    }

    try {
        await createUserWithEmailAndPassword(auth, newEmail, newPassword);
        window.location.href = 'profiles.html';
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
