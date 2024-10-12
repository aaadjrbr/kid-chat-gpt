// profiles.js
import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";

const profilesContainer = document.getElementById('profiles-container');
const auth = getAuth();
let currentKidId = null; // Used to track which kid is being edited

// Function to load profiles
export async function loadProfiles() {
    try {
        console.log("Loading profiles...");
        
        // Display loading message
        profilesContainer.innerHTML = '<p class="loading-txt">⏳ Loading...</p>';

        // Check if a user is authenticated
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const parentId = user.uid;
                const kidsRef = collection(db, `parents/${parentId}/kids`);
                const querySnapshot = await getDocs(kidsRef);

                profilesContainer.innerHTML = ''; // Clear the "Loading..." message

                if (querySnapshot.empty) {
                    profilesContainer.innerHTML = '<p>No profiles found. Please add a profile.</p>';
                    return;
                }

                querySnapshot.forEach(doc => {
                    const kid = doc.data();
                    const kidId = doc.id;
                
                    const profileDiv = document.createElement('div');
                    profileDiv.classList.add('profile-item');
                    profileDiv.innerHTML = `
                    <img src="images/${kid.image || 'default.webp'}" alt="${kid.name}" class="profile-image">
                    <span class="kid-name-circle">${kid.name}</span>
                    `;                
                    
                    const optionsContainer = document.createElement('div'); // Create options container here
                    optionsContainer.classList.add('profile-options');
                    optionsContainer.style.display = 'none'; // Hide options by default
                    optionsContainer.innerHTML = `
                        <button onclick="viewChatHistory('${kidId}', '${kid.name}', event)">📝 Chat History</button>
                        <button onclick="startNewChat('${kidId}', '${kid.name}', event)">✨ New Chat</button>
                    `;
                    profileDiv.appendChild(optionsContainer);                    
                
                    profileDiv.addEventListener('click', () => {
                        loadChatOptions(kidId, kid.name, profileDiv, editButton); // Pass the correct profileDiv and editButton
                    });
                
                    const editButton = document.createElement('button');
                    editButton.textContent = "•••";
                    editButton.classList.add('edit-button');
                    editButton.addEventListener('click', (event) => {
                        event.stopPropagation(); // Prevent click from propagating to profileDiv
                        openEditModal(kidId, kid);
                    });
                    profileDiv.appendChild(editButton);
                
                    profilesContainer.appendChild(profileDiv);
                });                
            } else {
                window.location.href = 'index.html';
            }
        });
    } catch (error) {
        console.error("Error loading profiles:", error);
        profilesContainer.innerHTML = '<p>Error loading profiles. Check the console for details.</p>';
    }
}

// Function to add a new profile
export async function addProfile(name, age, image) {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error("User is not authenticated.");
            return;
        }

        const parentId = user.uid;
        const kidsRef = collection(db, `parents/${parentId}/kids`);
        await addDoc(kidsRef, { name: name, age: age, image: image || 'default.png' });
        console.log(`Profile added: ${name}, Age: ${age}, Image: ${image}`);
    } catch (error) {
        console.error("Error adding profile:", error);
    }
}

// Function to delete a profile
export async function deleteProfile(kidId) {
    try {
        const user = auth.currentUser;
        if (!user) return;
        const parentId = user.uid;
        const kidRef = doc(db, `parents/${parentId}/kids/${kidId}`);
        await deleteDoc(kidRef);
        console.log(`Profile deleted: ${kidId}`);
    } catch (error) {
        console.error("Error deleting profile:", error);
    }
}

// Function to open the edit modal
function openEditModal(kidId, kid) {
    currentKidId = kidId; // Set the current kid's ID for later use
    document.getElementById('edit-kid-name').value = kid.name;
    document.getElementById('edit-kid-age').value = kid.age; // Populate the current age value
    document.querySelector(`#edit-image-gallery .selected`)?.classList.remove('selected');
    document.querySelector(`#edit-image-gallery [data-image="${kid.image || 'default.png'}"]`)?.classList.add('selected');
    document.getElementById('edit-modal').style.display = 'block';
}

// Function to save changes
document.getElementById('save-changes-button').addEventListener('click', async () => {
    const newName = document.getElementById('edit-kid-name').value;
    const newImage = document.querySelector('#edit-image-gallery .selected')?.dataset.image || 'default.png';
    await editProfile(currentKidId, newName, newImage);
    document.getElementById('edit-modal').style.display = 'none';
    loadProfiles();
});

// Function to set up the delete button event listener
function setupDeleteButton() {
    const deleteProfileButton = document.getElementById('delete-profile-button');
    
    // Remove any existing event listener
    deleteProfileButton.removeEventListener('click', deleteProfileHandler);

    // Add the event listener only once
    deleteProfileButton.addEventListener('click', deleteProfileHandler);
}

// Function to handle deleting a profile
async function deleteProfileHandler() {
    if (!currentKidId) {
        console.error("No profile selected for deletion.");
        return; // Exit the function if there's no current profile selected
    }

    // Confirm deletion
    const confirmDeletion = confirm('Are you sure you want to delete this profile?');
    if (!confirmDeletion) {
        return; // Exit the function if the user cancels
    }

    try {
        // Perform the deletion
        await deleteProfile(currentKidId);
        currentKidId = null; // Reset currentKidId after deletion
        document.getElementById('edit-modal').style.display = 'none'; // Close the modal
        loadProfiles(); // Reload the profiles
    } catch (error) {
        console.error("Error during profile deletion:", error);
    }
}

// Call setupDeleteButton once when the page is loaded or whenever needed
setupDeleteButton();

// Export deleteProfileHandler so it can be used in other files
export { deleteProfileHandler };

// Function to edit a profile
export async function editProfile(kidId, newName, newAge, newImage) {
    try {
        const user = auth.currentUser;
        if (!user) return;
        const parentId = user.uid;
        const kidRef = doc(db, `parents/${parentId}/kids/${kidId}`);
        await updateDoc(kidRef, { name: newName, age: newAge, image: newImage }); // Update age along with other fields
        console.log(`Profile updated: ${newName}, Age: ${newAge}, Image: ${newImage}`);
    } catch (error) {
        console.error("Error updating profile:", error);
    }
}

// Function to load chat options for a selected profile
export function loadChatOptions(kidId, kidName, profileDiv, editButton) {
    if (!profileDiv) {
        console.error('Profile div is not defined');
        return; // Avoid proceeding if profileDiv is not defined
    }

    const optionsContainer = profileDiv.querySelector('.profile-options');

    if (!optionsContainer) {
        console.error('Options container not found');
        return;
    }

// Toggle visibility with fade-in/fade-out effect
if (optionsContainer.classList.contains('show')) {
    // Fade out options
    optionsContainer.classList.remove('show');
    setTimeout(() => {
        optionsContainer.style.display = 'none';
    }, 5); // Delay for the fade-out effect to complete

    // Fade in edit button
    editButton.classList.remove('hide');
    setTimeout(() => {
        editButton.style.display = 'inline-block';
    }, 5); // Delay for the fade-in effect

    // Fade in profile image and name
    profileDiv.querySelector('.profile-image').classList.remove('hide');
    profileDiv.querySelector('.kid-name-circle').classList.remove('hide');
} else {
    // Display the options with fade-in effect
    optionsContainer.style.display = 'block';
    setTimeout(() => {
        optionsContainer.classList.add('show');
    }, 5); // Slight delay to trigger the fade-in

    // Fade out edit button
    editButton.classList.add('hide');
    setTimeout(() => {
        editButton.style.display = 'none';
    }, 5); // Delay for the fade-out effect to complete

    // Fade out profile image and name
    profileDiv.querySelector('.profile-image').classList.add('hide');
    profileDiv.querySelector('.kid-name-circle').classList.add('hide');
}


}

// Function to navigate to the chat page
export function startNewChat(kidId, kidName, event) {
    event.stopPropagation(); // Prevent click from triggering the profile options
    console.log(`Navigating to chat.html with kidId=${kidId}, kidName=${kidName}`);
    if (!kidId || !kidName) {
        console.error("Missing kidId or kidName.");
        return;
    }
    window.location.href = `chat.html?kidId=${encodeURIComponent(kidId)}&kidName=${encodeURIComponent(kidName)}`;
}

// Function to navigate to the history page
export function viewChatHistory(kidId, kidName, event) {
    event.stopPropagation(); // Prevent click from triggering the profile options
    console.log(`Navigating to history.html with kidId=${kidId}, kidName=${kidName}`);
    if (!kidId || !kidName) {
        console.error("Missing kidId or kidName.");
        return;
    }
    window.location.href = `history.html?kidId=${encodeURIComponent(kidId)}&kidName=${encodeURIComponent(kidName)}`;
}

// Function to set up image gallery for selection
export function setupImageGallery(containerId) {
    const imageContainer = document.getElementById(containerId);
    const images = ['image1.webp', 'image2.webp', 'image3.webp', 'default.webp', 'image4.webp']; // Include both .png and .webp formats
    images.forEach(image => {
        const imgElement = document.createElement('img');
        imgElement.src = `images/${image}`;
        imgElement.classList.add('gallery-image');
        imgElement.dataset.image = image;
        imgElement.addEventListener('click', () => {
            document.querySelector(`#${containerId} .selected`)?.classList.remove('selected');
            imgElement.classList.add('selected');
        });
        imageContainer.appendChild(imgElement);
    });
}

// Function to close the modal when the close button is clicked
document.querySelector('.close-button').addEventListener('click', () => {
    document.getElementById('edit-modal').style.display = 'none';
});

// Event listener to close the modal when clicking outside of it
window.addEventListener('click', (event) => {
    if (event.target === document.getElementById('edit-modal')) {
        document.getElementById('edit-modal').style.display = 'none';
    }
});
