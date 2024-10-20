import { auth } from './firebase-config.js';
import { applyActionCode, verifyPasswordResetCode, confirmPasswordReset } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";

// Get the action mode and action code from the URL
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const mode = urlParams.get('mode');
const actionCode = urlParams.get('oobCode');
const messageElement = document.getElementById('message');
const passwordResetForm = document.getElementById('password-reset-form');
const resetErrorMessage = document.getElementById('reset-error-message');
const emailVerificationSuccess = document.getElementById('email-verification-success');

// Handle different action types
switch (mode) {
    case 'resetPassword':
        handleResetPassword(actionCode);
        break;
    case 'verifyEmail':
        handleVerifyEmail(actionCode);
        break;
    default:
        messageElement.textContent = 'Unknown request. Please check the link and try again.';
}

// Handle password reset
async function handleResetPassword(actionCode) {
    try {
        // Verify the reset code and show the form if valid
        await verifyPasswordResetCode(auth, actionCode);
        messageElement.style.display = 'none';
        passwordResetForm.style.display = 'block';

        // Handle password reset form submission
        passwordResetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (newPassword !== confirmPassword) {
                resetErrorMessage.textContent = "Passwords do not match.";
                return;
            }

            try {
                await confirmPasswordReset(auth, actionCode, newPassword);
                messageElement.textContent = 'Password has been reset successfully!';
                passwordResetForm.style.display = 'none';
            } catch (error) {
                resetErrorMessage.textContent = 'Error resetting password. Please try again.';
            }
        });
    } catch (error) {
        messageElement.textContent = 'Error resetting your password. The link may be invalid or expired. Please try again.';
        console.error(error);
    }
}

// Handle email verification
async function handleVerifyEmail(actionCode) {
    try {
        await applyActionCode(auth, actionCode);
        messageElement.style.display = 'none';
        emailVerificationSuccess.style.display = 'block';
    } catch (error) {
        messageElement.textContent = 'Error verifying your email. The link may be invalid or expired. Please try again.';
        console.error(error);
    }
}
