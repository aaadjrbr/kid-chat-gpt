// profiles.js
import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";

const profilesContainer = document.getElementById('profiles-container');
const auth = getAuth();
let currentKidId = null; // Used to track which kid is being edited

// Function to check if user has a PIN in the "userpin" collection and prompt for creation if not
async function checkUserPin() {
    const auth = getAuth();
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Check session storage for cached PIN status
            const cachedPinStatus = sessionStorage.getItem('userPinExists');
            
            // If cached status exists, no need to check the database
            if (cachedPinStatus === 'true') {
                console.log("User PIN already cached. No need to check the database.");
                return;
            } else if (cachedPinStatus === 'false') {
                console.log("No PIN found in cache. Showing popup.");
                showPinCreationPopup(user.uid);
                return;
            }

            // If no cache, check the database
            const userPinRef = doc(db, 'userpin', user.uid);
            const userPinDoc = await getDoc(userPinRef);
            
            // If the user's pin document doesn't exist, show the popup for creating a PIN
            if (!userPinDoc.exists()) {
                console.log("No PIN found in userpin collection. Showing popup.");
                sessionStorage.setItem('userPinExists', 'false'); // Cache the result in session storage
                showPinCreationPopup(user.uid);
            } else {
                console.log("User already has a PIN in the userpin collection.");
                sessionStorage.setItem('userPinExists', 'true'); // Cache the result in session storage
            }
        } else {
            console.error("User not authenticated.");
        }
    });
}

// Function to show the PIN creation popup
function showPinCreationPopup(userId) {
    // Create the popup container
    const popupContainer = document.createElement('div');
    popupContainer.id = 'pin-popup';
    popupContainer.style.position = 'fixed';
    popupContainer.style.top = '50%';
    popupContainer.style.left = '50%';
    popupContainer.style.transform = 'translate(-50%, -50%)';
    popupContainer.style.padding = '30px';
    popupContainer.style.backgroundColor = '#f4f4f9';
    popupContainer.style.borderRadius = '15px';
    popupContainer.style.width = '350px';
    popupContainer.style.boxShadow = '0px 10px 20px rgba(0, 0, 0, 0.2)';
    popupContainer.style.zIndex = '1000';
    popupContainer.style.textAlign = 'center';

    // Add title and inputs
    popupContainer.innerHTML = `
        <h3>Create Your Personal PIN</h3>
        <label for="user-pin">Enter a 4-digit PIN:</label><br>
        <input type="number" id="user-pin" maxlength="4" placeholder="4-digit PIN" required><br><br>
        
        <label for="bestfriend">Who was your best friend during childhood?</label><br>
        <input type="text" id="bestfriend" placeholder="Best friend" required><br><br>
        <p>Remember: To create, save and edit accounts you need your PIN.</p>
        <button id="save-pin-btn">Save</button>
    `;

    // Append popup to body
    document.body.appendChild(popupContainer);

    // Handle saving the PIN and best friend answer
    document.getElementById('save-pin-btn').addEventListener('click', async () => {
        const pin = document.getElementById('user-pin').value;
        const bestFriend = document.getElementById('bestfriend').value;

        // Validate that both fields are filled and the PIN is 4 digits
        if (pin && bestFriend && pin.length === 4) {
            try {
                // Save the PIN and bestfriend to the "userpin" collection in Firestore
                const userPinRef = doc(db, 'userpin', userId);
                await setDoc(userPinRef, {
                    userpin: pin,
                    bestfriend: bestFriend
                });

                // Remove the popup after saving
                document.body.removeChild(popupContainer);
                console.log('PIN and best friend saved successfully in the userpin collection.');
            } catch (error) {
                console.error('Error saving PIN and best friend:', error);
            }
        } else {
            alert('Please enter a valid 4-digit PIN and answer the question.');
        }
    });
}

// Call checkUserPin after authentication to run the check
checkUserPin();


// Function to prompt for the PIN and verify it before allowing the action
export async function verifyUserPin(actionCallback) {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
        console.error("User not authenticated.");
        return;
    }

    // Create the PIN verification popup
    const popupContainer = document.createElement('div');
    popupContainer.id = 'pin-verification-popup';
    popupContainer.style.position = 'fixed';
    popupContainer.style.top = '50%';
    popupContainer.style.left = '50%';
    popupContainer.style.transform = 'translate(-50%, -50%)';
    popupContainer.style.padding = '30px';
    popupContainer.style.backgroundColor = '#f4f4f9';
    popupContainer.style.borderRadius = '15px';
    popupContainer.style.width = '350px';
    popupContainer.style.boxShadow = '0px 10px 20px rgba(0, 0, 0, 0.2)';
    popupContainer.style.zIndex = '1000';
    popupContainer.style.textAlign = 'center';

    // Add the PIN input field, toggle checkbox, and error message
    popupContainer.innerHTML = `
        <h3>Enter Your PIN 🔑</h3>
        <input type="password" id="entered-pin" maxlength="4" placeholder="4-digit PIN" required><br><br>
        <label>
            <input type="checkbox" id="toggle-pin-visibility">
            Show PIN
        </label>
        <p><a href="./forgot-pin.html">Forgot your PIN?</a></p>
        <p id="pin-error-message" style="color: red; display: none;">Invalid PIN. Please try again.</p>
        <button id="submit-pin-btn">Verify PIN</button>
        <button id="cancel-pin-btn" style="margin-left: 10px;">Cancel</button>
    `;

    // Append the popup to the body
    document.body.appendChild(popupContainer);

    // Add event listener for toggling PIN visibility
    document.getElementById('toggle-pin-visibility').addEventListener('change', () => {
        const pinInput = document.getElementById('entered-pin');
        if (pinInput.type === 'password') {
            pinInput.type = 'text'; // Show the PIN
        } else {
            pinInput.type = 'password'; // Hide the PIN (dots)
        }
    });

    // Add event listeners for the submit and cancel buttons
    document.getElementById('submit-pin-btn').addEventListener('click', async () => {
        const enteredPin = document.getElementById('entered-pin').value;

        // Validate that the input is a 4-digit number
        if (enteredPin.length !== 4 || isNaN(enteredPin)) {
            document.getElementById('pin-error-message').textContent = "Invalid input. Please enter a valid 4-digit PIN.";
            document.getElementById('pin-error-message').style.display = 'block';
            return;
        }

        // Fetch the user's PIN from Firestore
        const userPinRef = doc(db, 'userpin', user.uid);
        const userPinDoc = await getDoc(userPinRef);

        if (userPinDoc.exists()) {
            const userData = userPinDoc.data();

            // Check if the entered PIN matches the stored one
            if (enteredPin === userData.userpin) {
                console.log("PIN verified successfully.");
                document.body.removeChild(popupContainer); // Close the popup
                actionCallback(); // Call the callback after verification
                return;
            } else {
                document.getElementById('pin-error-message').textContent = "Incorrect PIN. Please try again.";
                document.getElementById('pin-error-message').style.display = 'block';
            }
        } else {
            console.error("No PIN found for this user.");
            document.getElementById('pin-error-message').textContent = "No PIN found. Please create one.";
            document.getElementById('pin-error-message').style.display = 'block';
        }
    });

    // Add a cancel button to close the popup without verifying the PIN
    document.getElementById('cancel-pin-btn').addEventListener('click', () => {
        document.body.removeChild(popupContainer); // Close the popup
    });
}

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

                    // Add click event listener on the profileDiv to toggle the options
                    profileDiv.addEventListener('click', () => {
                        toggleOptionsWithPin(optionsContainer, profileDiv.querySelector('.edit-button'), profileDiv);
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

        // Display success message
        displaySuccessMessage("Profile added successfully!");

    } catch (error) {
        console.error("Error adding profile:", error);
    }
}

// Function to display success message in the UI
function displaySuccessMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.className = 'success-message'; // Add a class for styling if needed
    document.body.appendChild(messageDiv);

    // Optionally, remove the message after a few seconds
    setTimeout(() => {
        messageDiv.remove();
    }, 3000); // Adjust the time (3 seconds) as needed
}

// Function to delete a profile with PIN verification
export async function deleteProfileWithPin(kidId) {
    verifyUserPin(async () => {
        const user = auth.currentUser;
        const parentId = user.uid;
        const kidRef = doc(db, `parents/${parentId}/kids/${kidId}`);
        await deleteDoc(kidRef);
        console.log(`Profile deleted: ${kidId}`);

        // Close the edit modal after deletion
        document.getElementById('edit-modal').style.display = 'none';

        loadProfiles(); // Refresh the profiles list
    });
}

// Modify your delete profile handler to use the PIN check and close the modal after deletion
async function deleteProfileHandler() {
    if (!currentKidId) {
        console.error("No profile selected for deletion.");
        return;
    }

    const confirmDeletion = confirm("Are you sure you want to delete this profile?");
    if (!confirmDeletion) return;

    await deleteProfileWithPin(currentKidId); // Deletes the profile and closes the modal in `deleteProfileWithPin`
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

async function saveProfileWithPin(kidId, newName, newAge, newImage) {
    verifyUserPin(async () => {
        await editProfile(kidId, newName, newAge, newImage);
        console.log("Profile saved successfully.");
        loadProfiles();
    });
}

// Modify your save profile event listener to use the PIN check
document.getElementById('save-changes-button').addEventListener('click', async () => {
    const newName = document.getElementById('edit-kid-name').value;
    const newAge = document.getElementById('edit-kid-age').value;
    const newImage = document.querySelector('#edit-image-gallery .selected')?.dataset.image || 'default.png';

    if (newName && newAge && newImage) {
        saveProfileWithPin(currentKidId, newName, newAge, newImage);
        document.getElementById('edit-modal').style.display = 'none';
    } else {
        console.error("Missing required fields for profile update.");
    }
});

// Function to set up the delete button event listener
function setupDeleteButton() {
    const deleteProfileButton = document.getElementById('delete-profile-button');
    
    // Remove any existing event listener
    deleteProfileButton.removeEventListener('click', deleteProfileHandler);

    // Add the event listener only once
    deleteProfileButton.addEventListener('click', deleteProfileHandler);
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
}

// Toggle visibility with fade-in/fade-out effect
export async function toggleOptionsWithPin(optionsContainer, editButton, profileDiv) {
    const toggleAction = async () => {
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
    };

    // Execute the toggle action
    await toggleAction();
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
    const images = ['default.webp', 'image2.webp', 'image3.webp', 'image4.webp', 'image5.webp',  'image6.webp', 'image7.webp', 'image8.webp', 'image9.webp', 'image10.webp', 'image11.webp']; // Include both .png and .webp formats
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
