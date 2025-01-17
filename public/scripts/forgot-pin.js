import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";

let attemptCount = 0; // Track the number of incorrect attempts

// Function to handle PIN reset
async function resetPin(event) {
    event.preventDefault();
    const auth = getAuth();
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userPinRef = doc(db, 'userpin', user.uid);
            const userPinDoc = await getDoc(userPinRef);
            
            if (userPinDoc.exists()) {
                const userData = userPinDoc.data();
                const enteredPin = document.getElementById('new-pin').value;
                const confirmedPin = document.getElementById('new-pin-confirm').value;
                const securityAnswer = document.getElementById('security-answer').value;
                const statusMessage = document.getElementById('status-message');
                
                // Check if new PINs match
                if (enteredPin !== confirmedPin || enteredPin.length !== 4) {
                    statusMessage.textContent = "The new PINs do not match or are not 4 digits!";
                    statusMessage.style.color = 'red';
                    return;
                }

                // Check if the best friend answer matches
                if (securityAnswer.toLowerCase() === userData.bestfriend.toLowerCase()) {
                    // If the answer matches, update the user's PIN
                    await updateDoc(userPinRef, {
                        userpin: enteredPin
                    });
                    statusMessage.textContent = "Your PIN has been successfully reset!";
                    statusMessage.style.color = 'green';
                    attemptCount = 0; // Reset the attempt count after success
                } else {
                    // Handle incorrect security answer
                    attemptCount++;
                    const remainingAttempts = 3 - attemptCount;

                    if (remainingAttempts > 0) {
                        statusMessage.textContent = `Incorrect answer. You have ${remainingAttempts} attempts left before your PIN is deleted.`;
                    } else {
                        // After 3 failed attempts, delete the userpin and bestfriend fields
                        await deleteDoc(userPinRef);
                        statusMessage.textContent = "You have exceeded the maximum number of attempts. Your PIN has been deleted.";
                        
                        // Log out the user and redirect to login.html
                        await signOut(auth);
                        window.location.href = 'login.html';  // Redirect to login page
                    }

                    statusMessage.style.color = 'red';
                }
            } else {
                console.error("No PIN document found for this user.");
                const statusMessage = document.getElementById('status-message');
                statusMessage.textContent = "No PIN found for this user. Please create one.";
                statusMessage.style.color = 'red';
            }
        } else {
            console.error("User not authenticated.");
            const statusMessage = document.getElementById('status-message');
            statusMessage.textContent = "You must be logged in to reset your PIN.";
            statusMessage.style.color = 'red';
        }
    });
}

// Attach form submission handler
document.getElementById('forgot-pin-form').addEventListener('submit', resetPin);

// Toggle
document.getElementById('toggleBox').addEventListener('click', function(e) {
    e.preventDefault(); // Prevent the default link behavior
    const contentBox = document.getElementById('contentBox');
    
    if (contentBox.classList.contains('visible')) {
        // Hide the box with fade-out effect
        contentBox.classList.remove('visible');
        setTimeout(() => {
            contentBox.classList.add('hidden');
        }, 500); // Matches the CSS transition duration
    } else {
        // Show the box with fade-in effect
        contentBox.classList.remove('hidden');
        setTimeout(() => {
            contentBox.classList.add('visible');
        }, 10); // Small delay to allow the opacity transition
    }
});
