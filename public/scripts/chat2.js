import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-storage.js";

// Retrieve kidId from URL parameters for loading individual profiles
const urlParams = new URLSearchParams(window.location.search);
const kidId = urlParams.get('kidId'); // kidId passed as a URL parameter
let parentId;

// Placeholder for the default background image
const originalBgUrl = 'https://firebasestorage.googleapis.com/v0/b/kids-chatgpt.appspot.com/o/static%2Falfie-chat-bg1.webp?alt=media&token=4da3bccd-0ee3-4836-bcd1-cee0908a89fa';
const auth = getAuth();
const storage = getStorage();

// Cache mechanism to prevent redundant fetches
const bgCache = {};

// Function to load and set the background image for the chat
async function loadUserBackground(parentId, kidId) {
    try {
        const userDocRef = doc(db, `/parents/${parentId}/kids/${kidId}`);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
            const userData = docSnap.data();
            const chatBg = userData['chat-bg'] || originalBgUrl;
            loadCachedBg(kidId, chatBg);
            updateBackgroundImage(kidId, chatBg);
        }
    } catch (error) {
        console.error("Error loading background:", error);
    }
}

// Toggle visibility of background controls
document.getElementById('toggle-bg-controls').addEventListener('click', () => {
    const bgControls = document.getElementById('bg-controls');
    bgControls.style.display = bgControls.style.display === 'none' ? 'block' : 'none';
});

// Trigger the file upload dialog
document.getElementById('upload-bg').addEventListener('click', () => {
    document.getElementById('bg-upload').click();
});

// Cache and apply the background
function loadCachedBg(kidId, url) {
    const cacheKey = `customBg_${kidId}`;
    if (!bgCache[cacheKey]) {
        bgCache[cacheKey] = url;
    }
    document.getElementById('messages').style.backgroundImage = `url(${bgCache[cacheKey]})`;
}

// Update the background dynamically with a small delay for refresh
function updateBackgroundImage(kidId, url) {
    const messagesElem = document.getElementById('messages');
    messagesElem.style.backgroundImage = 'none';
    setTimeout(() => {
        const cacheKey = `customBg_${kidId}`;
        bgCache[cacheKey] = url;
        messagesElem.style.backgroundImage = `url(${bgCache[cacheKey] || url})`;
    }, 100);
}

// Compress the image before upload
async function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                const maxWidth = 800;
                const maxHeight = 600;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.7);
            };

            img.onerror = (err) => reject(err);
        };

        reader.onerror = (err) => reject(err);
    });
}

// Authentication state listener
onAuthStateChanged(auth, async (user) => {
    if (user) {
        parentId = user.uid;
        await loadUserBackground(parentId, kidId);  // Load background for specific kidId on page load
    }
});

// Event listener to upload and update background
document.getElementById('bg-upload').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file && parentId && kidId) {
        const compressedFile = await compressImage(file);
        const fileRef = ref(storage, `chat-backgrounds/${parentId}/${kidId}/${file.name}`);
        await uploadBytes(fileRef, compressedFile);
        const fileUrl = await getDownloadURL(fileRef);

        await updateDoc(doc(db, `/parents/${parentId}/kids/${kidId}`), { 'chat-bg': fileUrl });
        updateBackgroundImage(kidId, fileUrl);  // Update background immediately
    }
});

// Event listener to delete and reset background to the default
document.getElementById('delete-bg').addEventListener('click', async () => {
    if (parentId && kidId) {
        const userDocRef = doc(db, `/parents/${parentId}/kids/${kidId}`);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
            const userData = docSnap.data();
            const currentBgUrl = userData['chat-bg'];
            if (currentBgUrl && currentBgUrl !== originalBgUrl) {
                await deleteImageFromStorage(currentBgUrl);
            }
        }

        await updateDoc(doc(db, `/parents/${parentId}/kids/${kidId}`), { 'chat-bg': originalBgUrl });
        loadCachedBg(kidId, originalBgUrl);
        updateBackgroundImage(kidId, originalBgUrl);
    }
});

// Delete background image from storage
async function deleteImageFromStorage(imageUrl) {
    try {
        const filePath = imageUrl.split('o/')[1].split('?')[0];
        const fileRef = ref(storage, decodeURIComponent(filePath));
        await deleteObject(fileRef);
        console.log("Image deleted successfully from Firebase Storage.");
    } catch (error) {
        console.error("Error deleting image from Firebase Storage:", error);
    }
}

// Resizer - Chat Box Container
const resizer = document.getElementById('resizer');
const chatContainer = document.getElementById('chat-container');

resizer.addEventListener('mousedown', initResize);
resizer.addEventListener('touchstart', initResize, { passive: true });

function initResize(e) {
    window.addEventListener('mousemove', resize);
    window.addEventListener('touchmove', resize, { passive: true });

    window.addEventListener('mouseup', stopResize);
    window.addEventListener('touchend', stopResize);
}

function resize(e) {
    const newHeight = e.clientY || e.touches[0].clientY;
    chatContainer.style.height = `${newHeight}px`;
}

function stopResize() {
    window.removeEventListener('mousemove', resize);
    window.removeEventListener('touchmove', resize);
    window.removeEventListener('mouseup', stopResize);
    window.removeEventListener('touchend', stopResize);
}
