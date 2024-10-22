import { db } from './firebase-config.js'; // Your Firestore instance
import { collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-storage.js";

// Initialize Firebase Storage, Firestore, and Auth
const storage = getStorage(); // Initialize storage instance
const auth = getAuth(); // Initialize auth instance

// Placeholder for original background image (from CSS)
const originalBgUrl = 'https://firebasestorage.googleapis.com/v0/b/kids-chatgpt.appspot.com/o/static%2Fhalloween-bg-alfie.webp?alt=media&token=0949f6a4-467a-4c5b-a48e-f09383af89a4';

// Cache mechanism
const bgCache = {};

// Function to cache and load background
function loadCachedBg(key, url) {
    if (!bgCache[key]) {
        bgCache[key] = url;
    }

    // Apply the background from the cache
    document.getElementById('messages').style.backgroundImage = `url(${bgCache[key]})`;

    // Log cache usage
    if (key === 'customBg') {
        console.log("Using user's background photo from cache.");
    } else if (key === 'defaultBg') {
        console.log("Using default background photo from cache.");
    }
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

                const maxWidth = 800; // Set your max width
                const maxHeight = 600; // Set your max height
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions
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

                // Convert the canvas back to a blob
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.7); // Adjust quality as needed
            };

            img.onerror = (err) => reject(err);
        };

        reader.onerror = (err) => reject(err);
    });
}

// Firebase authentication state change
onAuthStateChanged(auth, async (user) => {
    if (user) {
        parentId = user.uid; // Get the parentId from auth (assuming parentId is user UID)

        // Fetch the kidId from Firestore, or generate dynamically
        const kidsRef = collection(db, `/parents/${parentId}/kids`);
        const snapshot = await getDocs(kidsRef);
        if (!snapshot.empty) {
            kidId = snapshot.docs[0].id; // Assuming you take the first kid's ID dynamically
        }

        if (parentId && kidId) {
            const userDocRef = doc(db, `/parents/${parentId}/kids/${kidId}`);

            // Load the existing background if any
            loadUserBackground(userDocRef);

            // Trigger the hidden file input when the camera emoji is clicked
            document.getElementById('upload-bg').addEventListener('click', () => {
                document.getElementById('bg-upload').click();
            });

            // Handle background image upload
            document.getElementById('bg-upload').addEventListener('change', async (event) => {
                const file = event.target.files[0];
                if (file) {
                    const compressedFile = await compressImage(file); // Compress the image

                    const fileRef = ref(storage, `chat-backgrounds/${parentId}/${kidId}/${file.name}`);
                    await uploadBytes(fileRef, compressedFile);
                    const fileUrl = await getDownloadURL(fileRef);

                    // Save the background URL in Firestore
                    await updateDoc(userDocRef, {
                        'chat-bg': fileUrl
                    });

                    console.log("Background image uploaded and saved!");

                    // Refresh the page after background change
                    window.location.reload();
                }
            });

            // Handle deleting the background (reset to original)
            document.getElementById('delete-bg').addEventListener('click', async () => {
                // Update Firestore to remove the custom background
                await updateDoc(userDocRef, {
                    'chat-bg': originalBgUrl
                });

                // Cache and reset to original background
                loadCachedBg('defaultBg', originalBgUrl);
                console.log("Background image reset to original!");

                // Refresh the page after resetting to original background
                window.location.reload();
            });
        }
    }
});

// Function to load the existing background from Firestore and cache it
async function loadUserBackground(userDocRef) {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
        const userData = docSnap.data();
        const chatBg = userData['chat-bg'];
        if (chatBg) {
            loadCachedBg('customBg', chatBg);
        } else {
            loadCachedBg('defaultBg', originalBgUrl);
        }
    }
}
