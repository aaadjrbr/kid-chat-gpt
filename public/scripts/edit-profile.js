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
let isProfileUpdated = false;

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

function compressImage(file, maxWidth, maxHeight) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            image.src = e.target.result;
        };

        image.onload = () => {
            const canvas = document.createElement('canvas');
            let width = image.width;
            let height = image.height;

            // Calculate the new image dimensions while maintaining the aspect ratio
            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round((height *= maxWidth / width));
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round((width *= maxHeight / height));
                    height = maxHeight;
                }
            }

            // Set the canvas dimensions to the new image size
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0, width, height);

            // Convert the canvas to a Blob for uploading
            canvas.toBlob(
                (blob) => {
                    resolve(blob);
                },
                'image/jpeg',
                0.7 // Compression quality: adjust from 0.0 (worst) to 1.0 (best)
            );
        };

        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
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

    let isProfileUpdated = false; // Flag to track changes

    if (!currentUserUid) {
        status.textContent = 'You must be logged in to update your profile.';
        status.style.display = 'block'; // Show status with this message
        return;
    }

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
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
    
        // Update the DOM immediately after successful upload
        const profileImage = document.createElement('img');
        profileImage.src = profilePictureUrl;
        profileImage.alt = "Profile Picture";
        profileImage.style.width = '150px';
        profileImage.style.height = '150px';
        profilePictureContainer.innerHTML = '';
        profilePictureContainer.appendChild(profileImage);
    
        // Optionally, add the delete button back
        const deletePictureBtn = document.createElement('button');
        deletePictureBtn.textContent = 'Delete Photo';
        deletePictureBtn.addEventListener('click', deleteProfilePicture);
        profilePictureContainer.appendChild(deletePictureBtn);
    }    

    // Fetch existing user profile to ensure we don't overwrite fields like "isPremium", "isGold", and "tokens"
    const userDocRef = doc(db, 'userProfiles', currentUserUid);
    const userDoc = await getDoc(userDocRef);
    const existingData = userDoc.exists() ? userDoc.data() : {};
    
    // 2. Compare each field with the existing data and set the flag to true if something changed:
    if (name !== existingData.name || 
        email !== existingData.email || 
        phone !== existingData.phone || 
        JSON.stringify(kids) !== JSON.stringify(existingData.kids) || 
        profilePictureUrl !== existingData.profilePicture) {
        isProfileUpdated = true;
    }

    const userProfile = {
        name,
        email,
        phone,
        kids,
        profilePicture: profilePictureUrl || 'https://firebasestorage.googleapis.com/v0/b/kids-chatgpt.appspot.com/o/default-profile.webp?alt=media&token=8f1f9033-90a1-42c6-9845-aefd87fb6fdd',
        isPremium: existingData.isPremium || false,
        isGold: existingData.isGold || false,
        tokens: existingData.tokens || 30
    };

    try {
        await setDoc(doc(db, 'userProfiles', currentUserUid), userProfile, { merge: true });
        
        // 3. Only display the success message if something changed:
        if (isProfileUpdated) {
            status.textContent = 'Profile updated successfully!';
            status.style.display = 'block'; // Ensure it's visible if we have a message
        } else {
            status.style.display = 'none'; // Hide the status element entirely if no update happened
        }
    
        setTimeout(() => {
            status.style.display = 'none'; // Ensure it hides after 3 seconds
            status.textContent = '';
        }, 3000);
    } catch (error) {
        status.textContent = 'Error updating profile: ' + error.message;
        status.style.display = 'block'; // Show the error
        setTimeout(() => {
            status.style.display = 'none'; // Hide after the error message shows for 3 seconds
            status.textContent = '';
        }, 3000);
    }       
});