import { auth } from './firebase-config.js';
import { applyActionCode, checkActionCode, verifyPasswordResetCode, confirmPasswordReset } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";

// Get the action mode and action code from the URL
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const mode = urlParams.get('mode');
const actionCode = urlParams.get('oobCode');
const continueUrl = urlParams.get('continueUrl');
const lang = urlParams.get('lang') || 'en';
const messageElement = document.getElementById('message');

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
        const email = await verifyPasswordResetCode(auth, actionCode);
        const newPassword = prompt('Enter a new password for your account:');

        if (newPassword) {
            await confirmPasswordReset(auth, actionCode, newPassword);
            messageElement.textContent = 'Password has been reset successfully!';
        } else {
            messageElement.textContent = 'Password reset was canceled.';
        }
    } catch (error) {
        messageElement.textContent = 'Error resetting your password. Please try again.';
        console.error(error);
    }
}

// Handle email verification
async function handleVerifyEmail(actionCode) {
    try {
        await applyActionCode(auth, actionCode);
        messageElement.textContent = 'Your email has been verified successfully! You can now log in.';
    } catch (error) {
        messageElement.textContent = 'Error verifying your email. Please try again.';
        console.error(error);
    }
}
