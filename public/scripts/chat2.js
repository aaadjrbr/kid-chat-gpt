import { db } from './firebase-config.js'; // Your Firestore instance
import { collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-storage.js";

// Initialize Firebase Storage, Firestore, and Auth
const storage = getStorage(); // Initialize storage instance
const auth = getAuth(); // Initialize auth instance

// Placeholder for original background image (from CSS)
const originalBgUrl = 'https://firebasestorage.googleapis.com/v0/b/kids-chatgpt.appspot.com/o/static%2Fhalloween-bg-alfie.webp?alt=media&token=0949f6a4-467a-4c5b-a48e-f09383af89a4';

// Cache mechanism
const bgCache = {};

// Function to cache and load background
function loadCachedBg(kidId, url) {
    const cacheKey = `customBg_${kidId}`;
    if (!bgCache[cacheKey]) {
        bgCache[cacheKey] = url;
    }

    const messagesElem = document.getElementById('messages');
    messagesElem.style.backgroundImage = `url(${bgCache[cacheKey]})`;
}

// Function to force reflow and update the background dynamically
function updateBackgroundImage(kidId, url) {
    const messagesElem = document.getElementById('messages');
    messagesElem.style.backgroundImage = 'none';
    setTimeout(() => {
        const cacheKey = `customBg_${kidId}`;
        messagesElem.style.backgroundImage = `url(${bgCache[cacheKey] || url})`;
    }, 100);
}

// Assume these are fetched dynamically
let parentId;
let kidId;

// Toggle background controls
document.getElementById('toggle-bg-controls').addEventListener('click', () => {
    const bgControls = document.getElementById('bg-controls');
    bgControls.style.display = bgControls.style.display === 'none' ? 'block' : 'none';
});

// Handle image compression before upload
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

// Firebase authentication state change
onAuthStateChanged(auth, async (user) => {
    if (user) {
        parentId = user.uid;

        // Fetch the kidId from Firestore
        const kidsRef = collection(db, `/parents/${parentId}/kids`);
        const snapshot = await getDocs(kidsRef);
        if (!snapshot.empty) {
            kidId = snapshot.docs[0].id;
        }

        if (parentId && kidId) {
            const userDocRef = doc(db, `/parents/${parentId}/kids/${kidId}`);
            loadUserBackground(parentId, kidId);

            document.getElementById('upload-bg').addEventListener('click', () => {
                document.getElementById('bg-upload').click();
            });

            document.getElementById('bg-upload').addEventListener('change', async (event) => {
                const file = event.target.files[0];
                if (file) {
                    const compressedFile = await compressImage(file);

                    const fileRef = ref(storage, `chat-backgrounds/${parentId}/${kidId}/${file.name}`);
                    await uploadBytes(fileRef, compressedFile);
                    const fileUrl = await getDownloadURL(fileRef);

                    await updateDoc(userDocRef, {
                        'chat-bg': fileUrl
                    });

                    updateBackgroundImage(kidId, fileUrl);
                }
            });

            document.getElementById('delete-bg').addEventListener('click', async () => {
                try {
                    const docSnap = await getDoc(userDocRef);
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        const currentBgUrl = userData['chat-bg'];

                        if (currentBgUrl && currentBgUrl !== originalBgUrl) {
                            await deleteImageFromStorage(currentBgUrl);
                        }
                    }

                    await updateDoc(userDocRef, {
                        'chat-bg': originalBgUrl
                    });

                    loadCachedBg(kidId, originalBgUrl);
                    updateBackgroundImage(kidId, originalBgUrl);
                } catch (error) {
                    console.error("Error deleting background:", error);
                }
            });
        }
    }
});

// Function to delete image from Firebase Storage
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

// Function to load the existing background from Firestore and cache it
async function loadUserBackground(parentId, kidId) {
    const userDocRef = doc(db, `/parents/${parentId}/kids/${kidId}`);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
        const userData = docSnap.data();
        const chatBg = userData['chat-bg'] || originalBgUrl;
        loadCachedBg(kidId, chatBg);
        updateBackgroundImage(kidId, chatBg);
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
