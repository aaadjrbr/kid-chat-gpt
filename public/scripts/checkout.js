import { db } from './firebase-config.js';
import { getDoc, doc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";

// Get modal and content elements
const modal = document.getElementById("emailModal");
const submitBtn = document.getElementById("submitEmail");
const emailInput = document.getElementById("emailInput");
const errorMessage = document.getElementById("error-message");
const mainContent = document.getElementById("main-content");

// Function to open modal
function openModal() {
  modal.style.display = "block";
}

// Function to close modal
function closeModal() {
  modal.style.display = "none";
}

// Function to show main content
function showMainContent() {
  mainContent.style.visibility = "visible";
  mainContent.style.opacity = "1";
}

// Function to create a new user profile if it doesn't exist
async function createUserProfile(uid) {
  try {
    const userRef = doc(db, "userProfiles", uid);
    await setDoc(userRef, {
      email: null,  // Setting email as null initially, will ask the user to fill it
    });
    console.log(`New user profile created for ${uid}`);
    openModal();  // Prompt for email after creating profile
  } catch (error) {
    console.error("Error creating user profile: ", error);
    errorMessage.textContent = "An error occurred while creating your profile.";
    errorMessage.style.display = "block";
  }
}

// Function to update email
async function updateEmail(uid, newEmail) {
  try {
    const userRef = doc(db, "userProfiles", uid);
    await updateDoc(userRef, {
      email: newEmail
    });
    console.log(`Email updated successfully for user ${uid}: ${newEmail}`);
    closeModal(); // Close modal after successful update
    showMainContent(); // Show main content after email is updated
  } catch (error) {
    console.error("Error updating email: ", error);
    errorMessage.textContent = "An error occurred while updating your email.";
    errorMessage.style.display = "block";
  }
}

// Check if the user email exists, and create a profile if needed
async function checkUserEmail(uid) {
  try {
    const userRef = doc(db, "userProfiles", uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData.email) {
        console.log(`User ${uid} already has an email: ${userData.email}`);
        showMainContent(); // Show the content if email exists
      } else {
        console.log(`User ${uid} does not have an email. Prompting for email...`);
        openModal(); // Open modal if no email exists
      }
    } else {
      console.log(`No user profile found for user ${uid}, creating one...`);
      await createUserProfile(uid);  // Create profile if it doesn't exist
    }
  } catch (error) {
    console.error("Error checking user email: ", error);
    errorMessage.textContent = "An error occurred while checking your email.";
    errorMessage.style.display = "block";
  }
}

// Handle user email submission
submitBtn.addEventListener("click", async () => {
  const email = emailInput.value;
  if (email) {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      await updateEmail(user.uid, email);
    }
  } else {
    errorMessage.textContent = "Please enter a valid email.";
    errorMessage.style.display = "block";
  }
});

// Firebase Auth listener to get the current user
const auth = getAuth();
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log(`User is logged in: ${user.uid}`);
    checkUserEmail(user.uid); // Check email before showing main content
  } else {
    console.log("No user logged in");
  }
});
