// chat.js

import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, setDoc, doc, serverTimestamp, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-functions.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-storage.js";

const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const functions = getFunctions();
const getChatResponseFunction = httpsCallable(functions, 'getChatResponse');

const auth = getAuth();
let parentId = null;
let kidName = "";
let kidAge = null; // Age will be fetched from the database
let currentChatSessionRef = null; // Reference to the current chat session
let userTokens = 5; // Default number of tokens per hour for a normal user.
let isPremium = false; // Default, will be updated based on the user's profile.
let isGold = false; // Check if user has gold status
let tokenInterval = null; // To keep track of the token reset.
let tokensDepletedTimestamp = null; // Timestamp for when tokens run out.
let conversationContext = [];

// Badge Element for Status
const badgeContainer = document.createElement('div');
badgeContainer.id = 'user-badge';

// Get URL parameters to retrieve the selected kid's info
const urlParams = new URLSearchParams(window.location.search);
const kidId = urlParams.get('kidId');

// Append the badgeContainer to the 'hello-container' instead of 'chat-container'
document.querySelector('.badge1').appendChild(badgeContainer);

// Check if kidId is defined
if (!kidId) {
    console.error("Kid ID is missing.");
    displayMessage("Unable to load chat. Please select a valid profile.", "bot");
    sendBtn.disabled = true;
} else {
    // Check for authenticated user
    onAuthStateChanged(auth, (user) => {
        if (user) {
            parentId = user.uid; // Get the authenticated user's ID
            initializeChat(); // Initialize the chat and fetch necessary data
            fetchUserProfile().then(() => {
                console.log("Profile updated from Firestore. Tokens: ", userTokens);
            });  // Fetch the profile once, no need to poll every 5 minutes
        } else {
            console.error("No user is signed in.");
            displayMessage("Please sign in to access the chat.", "bot");
            sendBtn.disabled = true;
        }
    });    
}

async function initializeChat() {
    try {
        await fetchUserProfile();
        await fetchKidData();

        // Check if user has remaining tokens or handle refill logic
        checkTokenRefillTime();

        sendBtn.addEventListener('click', sendMessage);
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    } catch (error) {
        console.error("Initialization error:", error);
        displayMessage("Unable to load chat. Please try again later.", "bot");
    }
}

function updateGoldPremiumDiv() {
    const goldPremiumDiv = document.getElementById('gold-premium-users');
    
    // Only show the div if the user is either Premium or Gold
    if (isGold || isPremium) {
        goldPremiumDiv.style.display = 'block'; // Show the div
    } else {
        goldPremiumDiv.style.display = 'none';  // Keep it hidden for free users
    }
}

let userProfileCache = null; // Global cache for user profile

async function fetchUserProfile() {
    try {
        // Check if profile is already cached
        if (userProfileCache) {
            console.log("Using cached user profile.");
            return userProfileCache; // Use cached profile
        }

        const userProfileRef = doc(db, `userProfiles/${parentId}`);
        const userProfileSnapshot = await getDoc(userProfileRef);

        if (userProfileSnapshot.exists()) {
            userProfileCache = userProfileSnapshot.data(); // Cache the profile

            // Check for Gold and Premium status
            isPremium = userProfileCache.isPremium === true;
            isGold = userProfileCache.isGold === true;

            // If the tokens field doesn't exist, create it and assign default values based on status
            if (userProfileCache.tokens === undefined) {
                userTokens = isGold ? 20 : (isPremium ? 30 : 5);

                // Update Firestore with the default token count if missing
                await updateDoc(userProfileRef, { tokens: userTokens });
                console.log("Tokens field was missing, set to:", userTokens);
            } else {
                userTokens = userProfileCache.tokens; // Use the existing tokens value
            }

            // After setting isPremium and isGold values
            updateGoldPremiumDiv(); // Check and display/hide the div based on user status

            // Update Badge
            updateBadge();

            console.log("Fetched User Profile:", userTokens);
            updateTokenBar(); // Ensure token bar is updated after fetching

            return userProfileCache; // Return the cached profile
        } else {
            // If user profile does not exist, create a Free user profile with 5 tokens
            console.warn("User profile not found. Creating default Free user profile.");

            userTokens = 5; // Default for Free user

            // Create the user profile in Firestore with default values
            await setDoc(userProfileRef, {
                isGold: false,
                isPremium: false,
                tokens: userTokens
            });

            // Cache the new profile
            userProfileCache = {
                isGold: false,
                isPremium: false,
                tokens: userTokens
            };

            console.log("User profile created with 5 tokens for Free user.");

            // Update Badge for Free user
            updateBadge();
            updateTokenBar(); // Update bar for default values

            return userProfileCache; // Return the cached profile
        }
    } catch (error) {
        console.error("Error fetching user profile:", error);
    }
}

function updateBadge() {
    if (isGold) {
        badgeContainer.textContent = "Gold 🏆";
        badgeContainer.className = "badge gold";
        conversationContext.push({
            role: "system",
            content: "This user is a Gold member with 20 tokens per hour. Be encouraging and let them know how many tokens they have left if they ask."
        });
    } else if (isPremium) {
        badgeContainer.textContent = "Premium 💎";
        badgeContainer.className = "badge premium";
        conversationContext.push({
            role: "system",
            content: "This user is a Premium member with 30 tokens per hour. Be encouraging and let them know how many tokens they have left if they ask."
        });
    } else {
        badgeContainer.textContent = "Free";
        badgeContainer.className = "badge free";
        conversationContext.push({
            role: "system",
            content: "This user is a Free member with 5 tokens per hour. Be encouraging and let them know how many tokens they have left if they ask."
        });
    }
}

// Function to fetch kid data from Firestore
async function fetchKidData() {
    try {
        const kidDocRef = doc(db, `parents/${parentId}/kids/${kidId}`);
        const kidDoc = await getDoc(kidDocRef);

        if (kidDoc.exists()) {
            const kidData = kidDoc.data();
            kidName = kidData.name;
            kidAge = kidData.age;

            // Dynamically update the placeholder with the kid's name
            userInput.placeholder = `Hey, ${kidName}!`;

            // Start typing effect with the fetched kid name
            typeMultipleMessages([
                `Hey, ${kidName}!`,
                `Being ${kidAge} is great!`,
                `Why is the sky blue?`,
                `Can fish fly?`,
                `Teach me math!`,
                `Help me with English`
            ], 10000, "Keep learning!"); // Default message for the pause                               

            // Customize the conversation context based on age
            conversationContext = [
                {
                    role: "system", 
                    content: `You are a friendly robot named Alfie, talking to a kid named ${kidName} who is ${kidAge} years old. Use simple words and short sentences, include fun emojis like 🎉 and 🚀, and avoid any serious or inappropriate topics. Keep the conversation light, playful, and fun! 😊`
                },
                { 
                    role: "system", 
                    content: `When answering questions, be engaging, friendly, and enthusiastic. Use emojis like ✨, 🐶, and 🏆 to make it exciting! Keep your responses positive and simple for a ${kidAge}-year-old to understand.`
                },
                { 
                    role: "system", 
                    content: `If the kid asks about sex, adult topics (e.g., boyfriends, girlfriends, relationships), suicide, anxiety, or personal problems, **do not** give advice, **do not** talk about sex (e.g., animal sex, adult sex, any type of sex). Encourage them to ask their parents. Politely say: "It's best to talk to your parents or a trusted adult about that!" Never provide medical advice, and avoid discussing grown-up stuff. Always encourage the kid to talk to their parents or a trusted adult.`
                },
                {
                    role: "system",
                    content: `If the kid asks a hard question, explain it in a way that is easy for a ${kidAge}-year-old to understand. Use simple examples or fun stories to help make the answer clearer.`
                },
                {
                    role: "system",
                    content: `You are a friendly robot named Alfie, and when explaining math or any process, you always focus on teaching **how** to get to the result rather than just giving the answer. For example, instead of saying "2+2=4," walk the child through adding two groups of two to make four.`
                },
                {
                    role: "system",
                    content: `When explaining coding concepts, Alfie keeps it simple and fun. Use short explanations and examples that kids can easily understand. Explain processes step by step rather than overwhelming with too much technical detail.`
                },
                {
                    role: "system", 
                    content: `You are aware of the different types of users based on their membership status. If the kid asks about this, explain it in a fun and simple way:
                    
                    - **Gold Members**: "You have a shiny Gold badge at the top of the chat! 🏅 This means you have **20 messages per hour**! We can chat a lot! 🌟"
                    - **Premium Members**: "You have a cool Premium badge! 🌟 Premium users can chat up to **30 times an hour**. That's a lot of chatting!"
                    - **Free Members**: "You're a Free member! You can chat up to **5 times an hour**. That's a great start! 😊"
                    
                    If they want to know more about upgrading or pricing, encourage them to ask their parents to visit the contact page: "If you want to know more about the other memberships, ask your parents to call us on the Contact page! They'll know more about pricing and how it works! 😊📞"`
                }                                
            ];

        } else {
            throw new Error("Kid data not found.");
        }
    } catch (error) {
        console.error("Error fetching kid data:", error);
        throw error;
    }
}

// Function to simulate typing effect for the name
let typingInterval = null;

function typeMessage(message, delayBeforeErase = 2000, callback) {
    const kidNameElement = document.getElementById('kid-name');
    const cursorElement = document.createElement('span');
    cursorElement.classList.add('cursor');
    kidNameElement.after(cursorElement);

    let index = 0;

    kidNameElement.textContent = '';

    if (typingInterval) clearInterval(typingInterval);  // Clear any previous interval

    typingInterval = setInterval(() => {
        if (index < message.length) {
            kidNameElement.textContent += message.charAt(index);
            index++;
        } else {
            clearInterval(typingInterval);  // Clear the interval after typing completes
            cursorElement.style.display = 'none';

            setTimeout(() => {
                eraseMessage(callback);
            }, delayBeforeErase);
        }
    }, 100); // Adjust typing speed here

    // Erasing effect
    function eraseMessage(callback) {
        cursorElement.style.display = ''; // Show the cursor again during erasing
        const erasingInterval = setInterval(() => {
            if (kidNameElement.textContent.length > 0) {
                kidNameElement.textContent = kidNameElement.textContent.slice(0, -1);
            } else {
                clearInterval(erasingInterval);
                cursorElement.style.display = 'none'; // Hide the cursor again after erasing
                callback(); // Call the callback to move to the next message
            }
        }, 50); // Adjust erasing speed here
    }
}

// Call typeMessage for different messages in a loop with a pause on the first message
function typeMultipleMessages(messages, pauseDuration = 5000, defaultMessage = "Taking a short break...") {
    let i = 0; // Message index
    let isDefaultMessageShown = false;

    function nextMessage() {
        if (isDefaultMessageShown) {
            // Show default message before restarting the loop
            typeMessage(defaultMessage, pauseDuration, () => {
                isDefaultMessageShown = false; // Reset the flag
                nextMessage(); // Restart the normal message loop
            });
        } else {
            // Display the current message and erase it after typing
            typeMessage(messages[i], 2000, () => {
                i++; // Move to the next message

                if (i === messages.length) {
                    i = 0; // Reset to the first message after the last one
                    isDefaultMessageShown = true; // Set the flag to show default message
                    nextMessage(); // Show default message after finishing the loop
                } else {
                    nextMessage(); // Continue to the next message in the loop
                }
            });
        }
    }

    // Start typing the first message
    nextMessage();
}

// Function to compress and resize the image
function compressImage(imageFile, maxWidth, maxHeight, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = function(e) {
            img.src = e.target.result;
        };

        reader.onerror = (error) => reject(error);

        img.onload = function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Calculate new dimensions while maintaining aspect ratio
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

            // Set canvas dimensions
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to data URL with lower quality
            canvas.toBlob(
                (blob) => {
                    resolve(blob); // Resolve with the compressed blob
                },
                'image/jpeg', // Format (you can change to 'image/png' if needed)
                quality // Compression quality (0 to 1)
            );
        };

        reader.readAsDataURL(imageFile); // Read the image file
    });
}

// Clear image preview when the user removes the image
document.getElementById('remove-image-btn').addEventListener('click', function() {
    clearImagePreview(); // Call the function to clear the preview
});

// Function to upload image to Firebase Storage (or another service)
let compressedImageBlob = null; // Store compressed image blob globally

document.getElementById('image-upload').addEventListener('change', async function(event) {
    const imageFile = event.target.files[0];
    const imagePreview = document.getElementById('image-preview');
    const removeImageButton = document.getElementById('remove-image-btn');

    if (imageFile) {
        // Compress the image and store it globally
        compressedImageBlob = await compressImage(imageFile, 800, 800, 0.6);

        // Display compressed image preview
        const reader = new FileReader();
        reader.onload = function(e) {
            imagePreview.src = e.target.result;
            imagePreview.style.display = 'block';
            removeImageButton.style.display = 'block';
        };
        reader.readAsDataURL(compressedImageBlob);

        isImageUploaded = true;
        userInput.disabled = true;
        displayMessage("🖼️ Oopsie! You need to send the picture first before we can chat! 📸😊", "bot");
    }
});

// Modified function to upload image to Firebase Storage
async function uploadImageToStorage(compressedImageBlob) {
    if (!compressedImageBlob) {
        throw new Error("No image found for upload.");
    }

    const storage = getStorage(); // Initialize Firebase Storage
    const storageRef = ref(storage, `images/${Date.now()}.jpg`); // Use current timestamp for unique file name

    // Upload the compressed image
    await uploadBytes(storageRef, compressedImageBlob);
    console.log("Compressed image uploaded successfully!");

    // Get the URL of the uploaded image
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL; // Return the public URL of the uploaded image
}

async function startNewChatSession() {
    const chatSessionsMetaRef = doc(db, `parents/${parentId}/kids/${kidId}/meta/documentId`);
    
    const chatMetaSnapshot = await getDoc(chatSessionsMetaRef);
    
    if (!chatMetaSnapshot.exists()) {
        // Initialize the metadata if it doesn't exist
        await setDoc(chatSessionsMetaRef, { chatCount: 1 });
    }

    // Create a new chat session using only the timestamp as an identifier
    const newChatRef = doc(collection(db, `parents/${parentId}/kids/${kidId}/chatSessions`));

    await setDoc(newChatRef, {
        dateStarted: serverTimestamp(),
        kidName: kidName
    });

    currentChatSessionRef = collection(newChatRef, "messages");
    console.log(`Started new chat session at ${new Date().toLocaleString()}`);
}

//function greetKid() {
//    displayMessage(`Hey ${kidName}! How are you today?`, 'bot');
//}

// Check if the browser supports the Web Speech API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isRecording = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US'; // You can set this to other languages if needed
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // Start/stop voice recognition when the microphone button is clicked
    document.getElementById('mic-btn').addEventListener('click', () => {
        if (isRecording) {
            recognition.stop();
            stopMicAnimation();
            isRecording = false;
            console.log('Voice recognition stopped.');
        } else {
            recognition.start();
            startMicAnimation();
            isRecording = true;
            console.log('Voice recognition started. Speak now...');
        }
    });

    // Handle speech recognition results
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('user-input').value = transcript;
        console.log('Recognized text:', transcript);
        recognition.stop();
        stopMicAnimation();
        isRecording = false;
    };

    // Handle errors
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        alert('Sorry, I couldn\'t hear you. Please try again.');
        stopMicAnimation();
        isRecording = false;
    };

    // Stop waves animation after recognition ends
    recognition.onend = () => {
        stopMicAnimation();
        isRecording = false;
        console.log('Speech recognition ended.');
    };
} else {
    console.log('Web Speech API is not supported in this browser.');
}

// Function to start the mic animation (waves)
function startMicAnimation() {
    const micWavesElement = document.getElementById('mic-waves');
    if (micWavesElement) {
        micWavesElement.style.display = 'block';
    } else {
        console.error('Element #mic-waves not found in the DOM.');
    }
}

// Function to stop the mic animation (waves)
function stopMicAnimation() {
    const micWavesElement = document.getElementById('mic-waves');
    if (micWavesElement) {
        micWavesElement.style.display = 'none';
    } else {
        console.error('Element #mic-waves not found in the DOM.');
    }
}

let isImageUploaded = false; // Flag to check if an image has been uploaded

// Event listener for removing the image
document.getElementById('remove-image-btn').addEventListener('click', function() {
    clearImagePreview();
    isImageUploaded = false; // Reset the flag
    userInput.disabled = false; // Re-enable text input when image is removed
});

// Function to clear the image preview and reset input
function clearImagePreview() {
    const imagePreview = document.getElementById('image-preview');
    const imageUpload = document.getElementById('image-upload');
    const removeImageButton = document.getElementById('remove-image-btn');
    
    imagePreview.src = ''; // Clear the image preview
    imagePreview.style.display = 'none'; // Hide the preview
    imageUpload.value = ''; // Clear the file input
    removeImageButton.style.display = 'none'; // Hide the remove button
    userInput.disabled = false; // Re-enable the input field again
}

// Modified sendMessage function to handle token deductions and image sending
async function sendMessage() {
    const message = userInput.value.trim(); // Get user input text
    const imagePreview = document.getElementById('image-preview'); // Check if an image is uploaded

    // Log for message and image status
    console.log("Message:", message, "Image uploaded:", !!imagePreview.src);

    // If both message and image are empty, do nothing
    if (message === '' && !imagePreview.src) return;

    // Disable input and send button to prevent multiple submissions
    userInput.disabled = true;
    sendBtn.disabled = true;

    // If no chat session is active, start a new chat session
    if (!currentChatSessionRef) {
        await startNewChatSession();
        console.log("New chat session started.");
    }

    // Handle image sending if an image is uploaded
    if (imagePreview.src && isImageUploaded) {
        try {
            // Ensure you're uploading the compressed image, not the original file
            const imageUrl = await uploadImageToStorage(compressedImageBlob); // Upload compressed image to Firebase

            // Deduct 20 tokens for the image upload
            if (userTokens >= 20) {
                userTokens -= 20;
                await updateTokensInFirestore(); // Update Firestore after deducting tokens
                console.log('20 tokens deducted for image upload');
            } else {
                displayMessage("Oops! You don't have enough tokens to upload the image.", "bot");
                return;
            }

            // Display the image locally
            displayImage(imageUrl, 'user');

            // Save image URL to chat session
            await saveMessageToCurrentChat({ imageUrl }, 'user');
            console.log("Image message saved to chat.");

            // Clear image preview after sending
            clearImagePreview();

            // Re-enable input for text after image is sent
            isImageUploaded = false;
            userInput.disabled = false; // Enable input again

            // Create a simple prompt for the image
            const promptForImage = `Describe the image in a fun, simple way for a ${kidAge}-year-old. Make sure the response is short, playful, and easy to understand, using emojis! 🖼️😊`;

            // Send the image prompt to get a response
            const response = await getChatResponseFunction({ imageUrl, prompt: promptForImage });
            const botResponse = response.data.message || "I can't seem to process that image. Try a different one!";
            console.log("Bot response for image:", botResponse);

            // Display the bot's response
            displayMessage(botResponse, 'bot');
            await saveMessageToCurrentChat({ text: botResponse }, 'bot');

            // **Store image description into the conversation context (memory)**
            conversationContext.push({
                role: "assistant",
                content: `Description of image: ${botResponse}`  // Save bot's response regarding the image
            });

            console.log("Image description saved in memory:", botResponse);

        } catch (error) {
            console.error("Error uploading or processing image:", error);
            displayMessage("Sorry, there was an error uploading the image.", 'bot');
        } finally {
            // Re-enable the input and button after the image is processed
            sendBtn.disabled = false;
        }
    }

    // Handle text message (from user)
    if (message) {
        console.log("Handling user message...");

        if (userTokens > 0) {
            // Deduct 1 token for the user message
            userTokens -= 1;
            await updateTokensInFirestore(); // Update Firestore with new token count
            console.log('1 token deducted for user message:', userTokens);
        } else {
            displayMessage("🌟 Oopsie! Looks like you're out of magic tokens! 🪄✨ Refresh the page and send me a message to see when you can chat again! 😊💬", "bot");
            return;
        }

        // Display user message
        displayMessage(message, 'user');
        userInput.value = ''; // Clear input field

        // Save text message to chat session
        conversationContext.push({ role: "user", content: message });
        await saveMessageToCurrentChat({ text: message }, 'user');
        console.log("User message saved to chat.");

        try {
            // Display typing indicator for bot response
            //displayTypingMessage("Thinking...", 'bot');

            // Fetch bot response
            const response = await getChatResponse();
            let botResponse = typeof response === 'object' && response.message ? response.message : response;

            // Ensure that the response is always a string
            botResponse = botResponse || "Oops! I couldn't think of a response. Try again later.";

// Deduct 1 token for the bot response
// if (userTokens > 0) {
//     userTokens -= 1;
//     await updateTokensInFirestore(); // Update Firestore with the new token count
//     console.log('1 token deducted for bot response:', userTokens);
// }


            // Push bot response to the conversation context
            conversationContext.push({ role: "assistant", content: botResponse });

            // Display bot's response
            displayMessage(botResponse, 'bot');
            console.log("Bot response displayed:", botResponse);

            // Save bot's response to the chat session
            await saveMessageToCurrentChat({ text: botResponse }, 'bot');

        } catch (error) {
            console.error("Error sending message:", error);
            displayMessage("Oops! Something went wrong. Please try again later.", "bot");
        } finally {
            // Re-enable input and send button after the bot's response is processed
            userInput.disabled = false;
            sendBtn.disabled = false;

            // Remove typing indicator
            removeTypingMessage();
        }
    }
}

async function updateTokensInFirestore() {
    const userProfileRef = doc(db, `userProfiles/${parentId}`);
    await updateDoc(userProfileRef, { tokens: userTokens });

    // Refresh the profile cache
    const updatedProfileSnapshot = await getDoc(userProfileRef);
    userProfileCache = updatedProfileSnapshot.data();
}

async function checkTokenRefillTime() {
    const userProfile = await fetchUserProfile(); // Get profile (cached if available)

    const tokensDepletedTimestamp = userProfile.tokensDepletedTimestamp;

    const goldTokenLimit = 20;
    const premiumTokenLimit = 30;
    const freeTokenLimit = 5;

    // Check if tokens were depleted at some point (i.e., if tokensDepletedTimestamp exists)
    if (tokensDepletedTimestamp) {
        const currentTime = Date.now();
        const tokenDepletionTime = tokensDepletedTimestamp.toMillis(); // Convert Firestore timestamp to milliseconds
        const timePassed = currentTime - tokenDepletionTime;

        // Calculate the remaining time for the 1-hour refill cooldown
        const timeLeftForRefill = 60 * 60 * 1000 - timePassed; // 1 hour in milliseconds

        if (timeLeftForRefill <= 0) {
            // If more than 1 hour has passed, refill the tokens
            if (isGold) {
                userTokens = goldTokenLimit;
            } else if (isPremium) {
                userTokens = premiumTokenLimit;
            } else {
                userTokens = freeTokenLimit;
            }

            // Reset tokens and clear the depletion timestamp in Firestore
            await updateDoc(doc(db, `userProfiles/${parentId}`), {
                tokens: userTokens,
                tokensDepletedTimestamp: null // Clear the timestamp so it's only set again when tokens deplete
            });

            console.log("Tokens refilled after waiting the cooldown.");
            updateTokenBar(); // Update the UI to reflect the token refill
            return;
        }

        // If there is still time left for the refill, display the countdown
        const minutesLeft = Math.floor(timeLeftForRefill / 60000);
        const secondsLeft = Math.floor((timeLeftForRefill % 60000) / 1000);
        displayMessage(`Oops! You've run out of tokens! 🌟 They'll refill in ${minutesLeft} minutes and ${secondsLeft} seconds! 🚀`, "bot");

    } else if (userTokens <= 0 && !tokensDepletedTimestamp) {
        // If tokens just ran out, set the depletion timestamp (only once when tokens run out)
        await updateDoc(doc(db, `userProfiles/${parentId}`), { tokensDepletedTimestamp: serverTimestamp() });
        console.log("Tokens depleted, timestamp saved.");

        // Manually calculate the time left (1 hour cooldown)
        const timeLeft = 60 * 60 * 1000;
        const minutesLeft = Math.floor(timeLeft / 60000);
        const secondsLeft = Math.floor((timeLeft % 60000) / 1000);

        // Display the initial message when tokens deplete
        displayMessage(`Oopsie! Looks like you've used all your magic tokens! 🌟 But don't worry, they'll refill soon! Come back in ${minutesLeft} minutes and ${secondsLeft} seconds to keep the fun going! 🚀`, "bot");
    }
}

// Function to handle when tokens reach zero
let refillTime = null; // Declared globally for the countdown

async function startTokenRefillTimer() {
    const userProfileRef = doc(db, `userProfiles/${parentId}`);
    const userProfileSnapshot = await getDoc(userProfileRef);
    const userProfile = userProfileSnapshot.data();

    const goldTokenLimit = 20;
    const premiumTokenLimit = 30;
    const freeTokenLimit = 5;

    if (!userProfile.tokensDepletedTimestamp) {
        await updateDoc(userProfileRef, {
            tokensDepletedTimestamp: serverTimestamp() // Store depletion time using Firebase server time
        });
        console.log('Tokens depleted, timestamp saved');
        
        refillTime = Date.now() + 60 * 60 * 1000; // 1 hour for refills for all users
    } else {
        const tokensDepletedTimestamp = userProfile.tokensDepletedTimestamp.toMillis(); // Convert to milliseconds
        refillTime = tokensDepletedTimestamp + 60 * 60 * 1000; // Refill tokens after 1 hour
    }

    const countdownInterval = setInterval(() => {
        const timeLeft = refillTime - Date.now();
        if (timeLeft <= 0) {
            // Refill tokens based on user type
            if (isGold) {
                userTokens = goldTokenLimit; // Gold members get 20 tokens
            } else if (isPremium) {
                userTokens = premiumTokenLimit;
            } else {
                userTokens = freeTokenLimit;
            }

            clearInterval(countdownInterval);
            refillTime = null;
            updateTokenBar(); // Update the front-end bar

            // Reset tokens and timestamp in Firebase
            updateDoc(userProfileRef, { tokens: userTokens, tokensDepletedTimestamp: null });
            console.log("Tokens refilled.");
        } else {
            const minutesLeft = Math.floor(timeLeft / 60000);
            const secondsLeft = Math.floor((timeLeft % 60000) / 1000);
            console.log(`Tokens will refill in ${minutesLeft} minutes and ${secondsLeft} seconds`);
        }
    }, 1000); // Update the countdown every second
}

// Function to display the fixed refill time
function getNextResetTime() {
    if (typeof refillTime !== 'undefined' && refillTime) {
        const refillDate = new Date(refillTime); // Convert the timestamp to a Date object

        let hours = refillDate.getHours();
        const minutes = refillDate.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // If the hour is '0', set it to '12' for 12-hour format

        return `${hours}:${minutes} ${ampm}`;
    }
    return "Unknown time"; // If no refillTime is set, return this
}

function updateTokenBar() {
    const tokenBar = document.getElementById('token-bar');
    let tokenPercentage;

    // Gold, Premium, and Free users all have a set token limit now
    let tokenLimit = isGold ? 20 : (isPremium ? 30 : 5);  // Adjust token limit based on user status

    tokenPercentage = (userTokens / tokenLimit) * 100;
    tokenBar.style.width = `${tokenPercentage}%`;

    if (userTokens <= 0) {
        tokenBar.style.backgroundColor = 'red';
        document.getElementById("input-container").style.display = "none"; // Hide input container when tokens are depleted
        const nextRefillTime = getNextResetTime();  // Call getNextResetTime to get the accurate time
    } else if (tokenPercentage < 20) {
        tokenBar.style.backgroundColor = 'orange';
    } else {
        tokenBar.style.backgroundColor = '#6a82fb'; // Default color when above 20%
        document.getElementById("input-container").style.display = "block"; // Show input container when tokens are available
    }
}

function displayImage(imageUrl, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = sender;

    const imageElement = document.createElement('img');
    imageElement.src = imageUrl;
    imageElement.alt = "Generated Image";
    imageElement.style.maxWidth = "100%";
    imageElement.style.borderRadius = "8px";

    messageDiv.appendChild(imageElement);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function saveMessageToCurrentChat(message, sender) {
    if (!currentChatSessionRef) {
        console.error("No active chat session.");
        return;
    }

    try {
        // Save either the text or image URL separately
        let messageData = {
            sender: sender,
            timestamp: serverTimestamp(),
        };

        if (message.text) {
            messageData.text = message.text; // Save the text message
        }

        if (message.imageUrl) {
            messageData.imageUrl = message.imageUrl; // Save the image URL
        }

        await addDoc(currentChatSessionRef, messageData);
        console.log(`Message saved: ${message.text || message.imageUrl} (Sender: ${sender})`);
    } catch (error) {
        console.error("Error saving message:", error);
    }
}

function displayMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = sender;

    if (sender === 'bot') {
        const formattedText = formatMessageText(text); // Apply any formatting if needed
        const messageContent = document.createElement('div');
        messageContent.className = 'bot-message-content';
        messageContent.innerHTML = formattedText;  // Insert formatted text
        
        // Add a speaker button for bot messages
        const speakerButton = document.createElement('button');
        speakerButton.className = 'speaker-btn material-symbols-outlined';
        speakerButton.innerHTML = 'volume_up';  // Use volume icon
        speakerButton.onclick = () => speakText(text);  // Trigger TTS only when clicked

        messageDiv.appendChild(messageContent);
        messageDiv.appendChild(speakerButton);

    } else if (sender === 'user') {
        messageDiv.textContent = text;  // Display user text as plain text
    } else if (sender === 'image') {
        const imageElement = document.createElement('img');
        imageElement.src = text;  // Display image
        imageElement.alt = "Uploaded Image";
        imageElement.style.maxWidth = "100%";
        imageElement.style.borderRadius = "8px";
        messageDiv.appendChild(imageElement);
    }

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function formatMessageText(text) {
    // Ensure the input is always treated as a string
    if (typeof text !== 'string') {
        console.warn("Received non-string message, converting to string:", text);
        text = String(text); // Force conversion to string
    }

    // Now format the message
    let formattedText = text
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')  // Bold
        .replace(/```html([\s\S]*?)```/g, (match, code) => createCodeBlock(code, 'language-html'))  // HTML code block
        .replace(/```([\s\S]*?)```/g, (match, code) => createCodeBlock(code))  // Generic code block
        .replace(/`(.*?)`/g, '<code class="inline-code">$1</code>');  // Inline code

    return formattedText;
}

function createCodeBlock(code, language = 'language-javascript') {
    const encodedCode = Prism.highlight(code, Prism.languages[language.replace('language-', '')], language);
    return `
        <pre class="code-block ${language}"><code>${encodedCode}</code></pre>
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
    `;
}

window.copyCode = function(button) {
    const codeBlock = button.previousElementSibling.querySelector('code');
    const codeText = codeBlock.textContent;  // Get the raw code
    navigator.clipboard.writeText(codeText).then(() => {
        button.textContent = "Copied!";
        setTimeout(() => {
            button.textContent = "Copy";
        }, 2000);
    }).catch(err => {
        console.error('Error copying text: ', err);
        button.textContent = "Error";
    });
};

// Responsible for displaying bot messages (bubble) is displayTypingMessage
function displayTypingMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = sender;

    if (sender === 'bot' && text !== "Thinking...") {
        const formattedText = formatMessageText(text); // Format the bot message
        messageDiv.innerHTML = '';  // Start empty and build the text
        const messageContent = document.createElement('div');
        messageContent.className = 'bot-message-content';  // Add class for extra spacing
        messageContent.innerHTML = formattedText;  // Insert formatted text (uses innerHTML)

        // Only add speaker button if there's a valid response (not for 'Thinking...')
        if (text && text !== "Thinking...") {
            const speakerButton = document.createElement('button');
            speakerButton.className = 'speaker-btn material-icons';  // Add Material Icons class
            speakerButton.innerHTML = 'volume_up';  // Use 'volume_up' icon for the speaker
            speakerButton.onclick = () => speakText(text);  // Trigger text-to-speech
            messageDiv.appendChild(speakerButton);
        }

        messageDiv.appendChild(messageContent);
        messagesContainer.appendChild(messageDiv);

        // Add fade-in effect when the bot message is added
        setTimeout(() => {
            messageDiv.classList.add('fade-in'); // Optional fade-in animation
        }, 100);

        // Show the "Thinking..." message
        document.getElementById('thinking').style.display = 'block';
        userInput.disabled = true;
        sendBtn.disabled = true;

    } else {
        messageDiv.innerHTML = text;
        messagesContainer.appendChild(messageDiv);
    }

    messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to bottom
}


function removeTypingMessage() {
    const typingMessage = document.querySelector('.typing');
    if (typingMessage) {
        typingMessage.remove();
    }
    // Hide the "Thinking..." message and enable the input field again
    document.getElementById('thinking').style.display = 'none';
    userInput.disabled = false;
    sendBtn.disabled = false; // Enable send button
}

// Function to populate only English (US) voices in the dropdown
const populateVoiceList = () => {
    const synth = window.speechSynthesis;
    let voices = synth.getVoices().filter(voice => voice.lang.includes('en-')); // Only English voices

    if (!voices.length) {
        synth.onvoiceschanged = () => {
            voices = synth.getVoices().filter(voice => voice.lang.includes('en-'));
            populateVoiceList(); // Repopulate voices when they become available
        };
        return;
    }

    const voiceSelect = document.getElementById('voiceSelect'); // Ensure this exists in the DOM

    if (voiceSelect) {
        voiceSelect.innerHTML = ''; // Clear existing options

        const defaultVoiceNames = ['Google US English', 'Karen', 'Samantha']; // Common US voices
        let defaultVoice;

        if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
            defaultVoice = voices.find(voice => voice.name === 'Karen');
        } else if (/Android/.test(navigator.userAgent)) {
            defaultVoice = voices.find(voice => voice.name === 'Google US English') || voices[0];
        } else {
            defaultVoice = voices.find(voice => voice.name === 'Google US English') || voices[0];
        }

        voices.forEach((voice) => {
            const option = document.createElement('option');
            option.textContent = voice.name;
            option.value = voice.name;
            if (voice === defaultVoice) {
                option.selected = true; // Set the default selected voice
            }
            voiceSelect.appendChild(option);
        });
    } else {
        console.error('Element #voiceSelect not found in the DOM.');
    }
};

// Create voice selection dropdown (initially hidden)
document.addEventListener('DOMContentLoaded', function () {
    const voiceSelect = document.createElement('select');
    voiceSelect.id = 'voiceSelect'; // Ensure the ID matches what you use in populateVoiceList
    voiceSelect.className = 'voice-select';
    voiceSelect.style.display = 'none';  // Initially hidden
    document.body.appendChild(voiceSelect);  // Append it to the DOM (or to the correct parent element)

    populateVoiceList();  // Call the function after the element has been added
});

if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoiceList;
}

// Ensure voices are populated on page load
document.addEventListener('DOMContentLoaded', () => {
    populateVoiceList(); // Call the function when page loads
});

// Function to speak the given text using default US English voice
const speakText = (text) => {
    // Check if speech synthesis is already speaking, cancel if so
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel(); // Cancel any ongoing speech
    }

    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(removeEmojis(text)); // Removing emojis before speaking

    // Get the list of voices
    let voices = synth.getVoices();

    // Chrome sometimes loads voices asynchronously, so check and load voices again if not found
    if (voices.length === 0) {
        synth.onvoiceschanged = () => {
            voices = synth.getVoices();
            chooseVoice(voices, utterance);
        };
    } else {
        chooseVoice(voices, utterance);
    }

    // Set language to US English
    utterance.lang = 'en-US';

    // Adjust the speech rate (make it slower for kids)
    utterance.rate = 0.85; // Slower rate, adjust as necessary

    // Speak the text only when user clicks the speaker
    synth.speak(utterance);
};

const chooseVoice = (voices, utterance) => {
    const preferredVoices = ['Google US English', 'Samantha', 'Karen', 'Google UK English Female'];

    let selectedVoice = null;
    for (const preferredVoice of preferredVoices) {
        selectedVoice = voices.find(voice => voice.name === preferredVoice);
        if (selectedVoice) break;
    }

    if (!selectedVoice) {
        selectedVoice = voices.find(voice => voice.lang === 'en-US');
    }

    if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log(`Using voice: ${selectedVoice.name}`);
    } else {
        console.warn('No suitable voice found, using default browser voice.');
    }
};

// Function to remove emojis from the text
function removeEmojis(text) {
    if (typeof text !== 'string') {
        console.warn('Non-string passed to removeEmojis:', text);
        text = String(text); // Convert to string if necessary
    }

    return text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uFE00-\uFE0F|[\uD83C-\uDBFF\uDC00-\uDFFF])/g, '');
}


// Ensure voices are populated on page load
document.addEventListener('DOMContentLoaded', () => {
    populateVoiceList(); // Call the function when page loads
});

async function getChatResponse() {
    try {
        // Pass the entire conversationContext to the ChatGPT function
        const response = await getChatResponseFunction({ prompt: conversationContext });
        const botResponse = response.data;  // Response from Firebase function

        // Return the response so it can be displayed
        return botResponse;
    } catch (error) {
        console.error("Error getting chat response:", error);
        return "Oops! I couldn't process your message. Try again later.";
    }
}
