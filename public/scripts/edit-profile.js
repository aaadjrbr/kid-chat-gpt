import { db } from './firebase-config.js';
import { doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-storage.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";

const userForm = document.getElementById('user-form');
const profilePictureInput = document.getElementById('profilePicture');
const profilePictureContainer = document.getElementById('profile-picture-container');
const addKidBtn = document.getElementById('add-kid-btn');
const kidsContainer = document.getElementById('kids-container');
const status = document.getElementById('status');
let kidCount = 0; // Start counting kids from 0 to handle the fixed placeholder separately

const auth = getAuth();
let currentUserUid = null;
let currentProfilePictureRef = '';

// Function to handle adding more kids
addKidBtn.addEventListener('click', () => {
    addKidInput();
});

// Function to add a kid input dynamically with a remove button
function addKidInput(kid = '', id = null) {
    kidCount++;
    const kidDiv = document.createElement('div');
    kidDiv.classList.add('kid-entry');
    
    const newKidInput = document.createElement('input');
    newKidInput.type = 'text';
    newKidInput.name = `kid${kidCount}`;
    newKidInput.placeholder = `Kid ${kidCount}`;
    newKidInput.value = kid;
    newKidInput.classList.add('kid-input');

    // Remove button for kid inputs
    const removeKidBtn = document.createElement('button');
    removeKidBtn.textContent = 'Remove';
    removeKidBtn.classList.add('remove-kid-btn');
    removeKidBtn.addEventListener('click', () => {
        kidsContainer.removeChild(kidDiv); // Remove from UI
        removeKidFromFirestore(kid); // Remove from Firestore
        updateKidPlaceholders(); // Update the placeholders and counter
    });

    kidDiv.appendChild(newKidInput);
    kidDiv.appendChild(removeKidBtn);
    kidsContainer.appendChild(kidDiv);
}

// Function to update kid input placeholders after a kid is removed
function updateKidPlaceholders() {
    const kidInputs = document.querySelectorAll('.kid-input');
    kidCount = kidInputs.length; // Adjust kidCount to the actual number of kids remaining

    kidInputs.forEach((input, index) => {
        input.name = `kid${index + 1}`; // Update the input name based on the new order
        input.placeholder = `Kid ${index + 1}`; // Update the placeholder text
    });
}

// Wait for the user to be authenticated and fetch existing user data if available
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserUid = user.uid;
        await fetchUserData(currentUserUid);
    } else {
        status.textContent = 'Please log in to edit your profile.';
    }
});

// Function to fetch and populate the user data, checking for "isPremium", "isGold", and "tokens"
async function fetchUserData(uid) {
    const userDocRef = doc(db, 'userProfiles', uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
        const userData = userDoc.data();

        document.getElementById('name').value = userData.name || '';
        document.getElementById('email').value = userData.email || '';
        document.getElementById('phone').value = userData.phone || '';

        currentProfilePictureRef = userData.profilePicture || 'https://firebasestorage.googleapis.com/v0/b/kids-chatgpt.appspot.com/o/default-profile.webp?alt=media&token=8f1f9033-90a1-42c6-9845-aefd87fb6fdd';
        const profileImage = document.createElement('img');
        profileImage.src = currentProfilePictureRef;
        profileImage.alt = "Profile Picture";
        profileImage.style.width = '150px';
        profileImage.style.height = '150px';
        profilePictureContainer.innerHTML = '';
        profilePictureContainer.appendChild(profileImage);

        if (userData.profilePicture) {
            const deletePictureBtn = document.createElement('button');
            deletePictureBtn.textContent = 'Delete Photo';
            deletePictureBtn.addEventListener('click', deleteProfilePicture);
            profilePictureContainer.appendChild(deletePictureBtn);
        }

        // Populate the kids section
        if (userData.kids && userData.kids.length > 0) {
            userData.kids.forEach((kid) => {
                addKidInput(kid);
            });
        }

        // Ensure the fields "isPremium", "isGold", and "tokens" exist in the Firestore document
        let updatesNeeded = false;
        const updates = {};

        if (userData.isPremium === undefined) {
            updates.isPremium = false;
            updatesNeeded = true;
        }

        if (userData.isGold === undefined) {
            updates.isGold = false;
            updatesNeeded = true;
        }

        if (userData.tokens === undefined) {
            updates.tokens = 30; // Default tokens for a free user
            updatesNeeded = true;
        }

        if (updatesNeeded) {
            await updateDoc(userDocRef, updates);
        }

    } else {
        console.log("No existing profile data for this user.");
    }
}

// Function to remove a kid from Firestore
async function removeKidFromFirestore(kidToRemove) {
    try {
        const userDoc = await getDoc(doc(db, 'userProfiles', currentUserUid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const updatedKids = userData.kids.filter(kid => kid !== kidToRemove); // Remove the kid from the array

            await updateDoc(doc(db, 'userProfiles', currentUserUid), { kids: updatedKids });
            status.textContent = 'Kid removed successfully!';
        }
    } catch (error) {
        console.error('Error removing kid:', error);
        status.textContent = 'Error removing kid.';
    }
}

// Function to delete the current profile picture
async function deleteProfilePicture() {
    if (!confirm('Are you sure you want to delete your profile picture?')) return;

    if (currentProfilePictureRef && currentProfilePictureRef !== 'https://firebasestorage.googleapis.com/v0/b/kids-chatgpt.appspot.com/o/default-profile.webp?alt=media&token=8f1f9033-90a1-42c6-9845-aefd87fb6fdd') {
        const storage = getStorage();
        const storageRef = ref(storage, currentProfilePictureRef);
        try {
            await deleteObject(storageRef);
            await updateDoc(doc(db, 'userProfiles', currentUserUid), { profilePicture: '' });

            profilePictureContainer.innerHTML = '';
            const defaultImage = document.createElement('img');
            defaultImage.src = 'https://firebasestorage.googleapis.com/v0/b/kids-chatgpt.appspot.com/o/default-profile.webp?alt=media&token=8f1f9033-90a1-42c6-9845-aefd87fb6fdd';
            defaultImage.alt = "Default Profile Picture";
            defaultImage.style.width = '150px';
            defaultImage.style.height = '150px';
            profilePictureContainer.appendChild(defaultImage);

            status.textContent = 'Profile picture deleted successfully!';
            currentProfilePictureRef = '';
        } catch (error) {
            console.error("Error deleting profile picture:", error);
            status.textContent = 'Error deleting profile picture.';
        }
    } else {
        status.textContent = 'No profile picture to delete.';
    }
}

// Save or update the user's profile
userForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentUserUid) {
        status.textContent = 'You must be logged in to update your profile.';
        return;
    }

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    // Filter out any empty kid inputs to prevent saving them in Firestore
    const kids = Array.from(document.getElementsByClassName('kid-input'))
                      .map(kidInput => kidInput.value)
                      .filter(kid => kid.trim() !== '');

    let profilePictureUrl = currentProfilePictureRef;
    const storage = getStorage();
    
    if (profilePictureInput.files[0]) {
        const file = profilePictureInput.files[0];
        const compressedFile = await compressImage(file, 150, 150);

        const storageRef = ref(storage, `profilePictures/${currentUserUid}`);
        await uploadBytes(storageRef, compressedFile);
        profilePictureUrl = await getDownloadURL(storageRef);
    }

    // Fetch existing user profile to ensure we don't overwrite fields like "isPremium", "isGold", and "tokens"
    const userDocRef = doc(db, 'userProfiles', currentUserUid);
    const userDoc = await getDoc(userDocRef);
    const existingData = userDoc.exists() ? userDoc.data() : {};

    const userProfile = {
        name,
        email,
        phone,
        kids,
        profilePicture: profilePictureUrl || 'https://firebasestorage.googleapis.com/v0/b/kids-chatgpt.appspot.com/o/default-profile.webp?alt=media&token=8f1f9033-90a1-42c6-9845-aefd87fb6fdd',
        // Merge existing fields to avoid overwriting them
        isPremium: existingData.isPremium || false,
        isGold: existingData.isGold || false,
        tokens: existingData.tokens || 30
    };

    try {
        await setDoc(doc(db, 'userProfiles', currentUserUid), userProfile, { merge: true });
        status.textContent = 'Profile updated successfully!';
        
        status.style.display = 'block';
    
        setTimeout(() => {
            status.style.display = 'none';
            status.textContent = '';
        }, 3000);
    } catch (error) {
        status.textContent = 'Error updating profile: ' + error.message;
        
        status.style.display = 'block';
    
        setTimeout(() => {
            status.style.display = 'none';
            status.textContent = '';
        }, 3000);
    }       
});
