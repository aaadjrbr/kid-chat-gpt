import { db } from './firebase-config.js';
import { doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-storage.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";

const userForm = document.getElementById('user-form');
const profilePictureInput = document.getElementById('profilePicture');
const profilePictureContainer = document.getElementById('profile-picture-container'); // To display the current photo
const addKidBtn = document.getElementById('add-kid-btn');
const kidsContainer = document.getElementById('kids-container');
const status = document.getElementById('status');
let kidCount = 1;

const auth = getAuth();
let currentUserUid = null;
let currentProfilePictureRef = ''; // Track the current profile picture URL

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

    // Remove button for dynamic kid inputs (not for Kid 1)
    const removeKidBtn = document.createElement('button');
    removeKidBtn.textContent = 'Remove';
    removeKidBtn.classList.add('remove-kid-btn');
    removeKidBtn.addEventListener('click', () => {
        kidsContainer.removeChild(kidDiv); // Remove from UI
        removeKidFromFirestore(kid); // Remove from Firestore
    });

    kidDiv.appendChild(newKidInput);
    kidDiv.appendChild(removeKidBtn);
    kidsContainer.appendChild(kidDiv);
}

// Wait for the user to be authenticated and fetch existing user data if available
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserUid = user.uid;  // Get the current user's UID
        await fetchUserData(currentUserUid);  // Fetch and populate the form if data exists
    } else {
        status.textContent = 'Please log in to edit your profile.';
    }
});

// Function to fetch and populate the user data
async function fetchUserData(uid) {
    const userDoc = await getDoc(doc(db, 'userProfiles', uid));
    if (userDoc.exists()) {
        const userData = userDoc.data();
        document.getElementById('name').value = userData.name || '';
        document.getElementById('email').value = userData.email || '';
        document.getElementById('phone').value = userData.phone || '';

        // Display current profile picture if it exists, otherwise show default
        currentProfilePictureRef = userData.profilePicture || 'https://via.placeholder.com/50';
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
            // First kid field will always remain, no remove option
            document.querySelector('.kid-input').value = userData.kids[0] || '';

            // Add dynamic fields for additional kids
            userData.kids.slice(1).forEach((kid) => {
                addKidInput(kid); // Add all additional kids dynamically
            });
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

            // Update the Firestore document with the new array of kids
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

    if (currentProfilePictureRef && currentProfilePictureRef !== 'https://via.placeholder.com/50') {
        const storage = getStorage();
        const storageRef = ref(storage, currentProfilePictureRef);
        try {
            await deleteObject(storageRef);  // Delete the photo from Firebase Storage
            await updateDoc(doc(db, 'userProfiles', currentUserUid), { profilePicture: '' });  // Remove profile picture from Firestore
            
            profilePictureContainer.innerHTML = '';  // Clear the current profile picture display
            const defaultImage = document.createElement('img');
            defaultImage.src = 'https://via.placeholder.com/50';  // Show default profile picture
            defaultImage.alt = "Default Profile Picture";
            defaultImage.style.width = '150px';
            defaultImage.style.height = '150px';
            profilePictureContainer.appendChild(defaultImage);

            status.textContent = 'Profile picture deleted successfully!';
            currentProfilePictureRef = '';  // Reset the picture reference
        } catch (error) {
            console.error("Error deleting profile picture:", error);
            status.textContent = 'Error deleting profile picture.';
        }
    } else {
        status.textContent = 'No profile picture to delete.';
    }
}

// Function to compress the image before uploading
function compressImage(file, maxWidth, maxHeight) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate the new dimensions
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

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(blob => {
                    resolve(blob);
                }, 'image/jpeg', 0.7); // 0.7 is the quality, adjust as needed
            };
        };
        reader.onerror = error => reject(error);
    });
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
    const kids = Array.from(document.getElementsByClassName('kid-input')).map(kidInput => kidInput.value);

    let profilePictureUrl = currentProfilePictureRef;  // Default to current profile picture if no new one is uploaded
    const storage = getStorage();
    
    // Handle profile picture upload with compression
    if (profilePictureInput.files[0]) {
        const file = profilePictureInput.files[0];

        // Compress the image to a smaller size for a profile picture
        const compressedFile = await compressImage(file, 150, 150); // Max dimensions 150x150

        const storageRef = ref(storage, `profilePictures/${currentUserUid}`); // Use UID for picture storage
        await uploadBytes(storageRef, compressedFile); // Upload the compressed image
        profilePictureUrl = await getDownloadURL(storageRef); // Get the download URL
    }

    // Create or update user profile object
    const userProfile = {
        name,
        email,
        phone,
        kids,
        profilePicture: profilePictureUrl || 'https://via.placeholder.com/50'
    };

    // Save to Firestore using the user's UID
    try {
        await setDoc(doc(db, 'userProfiles', currentUserUid), userProfile);
        status.textContent = 'Profile updated successfully!';
    } catch (error) {
        status.textContent = 'Error updating profile: ' + error.message;
    }
});
