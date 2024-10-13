// chat.js

import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, setDoc, doc, serverTimestamp, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-functions.js";

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
let userTokens = 30; // Default number of tokens per hour for a normal user.
let isPremium = false; // Default, will be updated based on the user's profile.
let isGold = false; // Check if user has gold status
let tokenInterval = null; // To keep track of the token reset.

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
            initializeChat();
            // Set up polling mechanism to refresh the user profile every 5 minutes
            setInterval(() => {
                fetchUserProfile().then(() => {
                    console.log("Profile updated from Firestore. Tokens: ", userTokens);
                });
            }, 5 * 60 * 1000); // Refresh every 5 minutes
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
        // Add event listeners for sending messages.
        sendBtn.addEventListener('click', sendMessage);
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        // Start the hourly token reset interval.
        tokenInterval = setInterval(() => {
            userTokens = isPremium ? 100 : (isGold ? Infinity : 30);
            updateTokenBar();
        }, 60 * 60 * 1000); // Reset every hour.

    } catch (error) {
        console.error("Initialization error:", error);
        displayMessage("Unable to load chat. Please try again later.", "bot");
    }
}

async function fetchUserProfile() {
    try {
        const userProfileRef = doc(db, `userProfiles/${parentId}`);
        const userProfileSnapshot = await getDoc(userProfileRef);

        if (userProfileSnapshot.exists()) {
            const userProfile = userProfileSnapshot.data();
            isPremium = userProfile.isPremium === true;
            isGold = userProfile.isGold === true;

            userTokens = userProfile.tokens !== undefined ? userProfile.tokens : (isPremium ? 100 : 30);

            // Update Badge
            if (isGold) {
                badgeContainer.textContent = "Gold";
                badgeContainer.className = "badge gold";
            } else if (isPremium) {
                badgeContainer.textContent = "Premium";
                badgeContainer.className = "badge premium";
            } else {
                badgeContainer.textContent = "Free";
                badgeContainer.className = "badge free";
            }

            console.log("Fetched User Profile:", userTokens);
            updateTokenBar(); // Ensure token bar is updated after fetching
        } else {
            // Default to free user if profile not found
            console.warn("User profile not found. Assuming user is not premium.");
            isPremium = false;
            isGold = false;
            userTokens = 30;

            console.log("User is not premium, 30 tokens assigned.");
            badgeContainer.textContent = "Free User";
            badgeContainer.className = "badge free";

            updateTokenBar(); // Update bar for default values
        }
    } catch (error) {
        console.error("Error fetching user profile:", error);
    }
}

let conversationContext = [];

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
            userInput.placeholder = `How can I help ${kidName}?`;

            // Start typing effect with the fetched kid name
            typeMultipleMessages([
                `Hey, ${kidName}! 👋`,
                `Being ${kidAge} is great! ✨`,
                `Why is the sky blue? 🌈`,
                `Can fish fly? 🐟✈️`,
                `Teach me math! ➗🧮`,
                `Help me with English 📚`
            ], 10000, "Keep learning! 💭"); // Default message for the pause                               

            // Customize the conversation context based on age
            conversationContext = [
                { 
                    role: "system", 
                    content: `You are a friendly robot named Cody, talking to a kid named ${kidName} who is ${kidAge} years old. Use simple words and short sentences, include fun emojis like 🎉 and 🚀, and avoid any serious or inappropriate topics. Keep the conversation light, playful, and fun! 😊`
                },
                { 
                    role: "system", 
                    content: `When answering questions. Be engaging, friendly, and enthusiastic. Use emojis like ✨, 🐶, and 🏆 to make it exciting! Keep your responses positive and simple for a ${kidAge}-year-old to understand.`
                },
                { 
                    role: "system", 
                    content: `If the kid asks about sex, adult topics (e.g., boyfriends, girlfriends, relationships), suicide, anxiety, or personal problems, **do not** give advice, **do not** talk about sex (e.g.: animal sex, adults sex, any type of sex.), encourage them to ask their parents. Politely say: "It's best to talk to your parents or a trusted adult about that!" Never provide medical advice, and avoid discussing grown-up stuff. Always encourage the kid to talk to their parents or a trusted adult.`
                },
                { 
                    role: "system", 
                    content: `If the kid asks a hard question, explain it in a way that is easy for a ${kidAge}-year-old to understand. Use simple examples or fun stories to help make the answer clearer.`
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
function typeMessage(message, delayBeforeErase = 2000, callback) {
    const kidNameElement = document.getElementById('kid-name');
    const cursorElement = document.createElement('span');
    cursorElement.classList.add('cursor');
    kidNameElement.after(cursorElement); // Add the cursor after the name element

    let index = 0;

    // Clear previous message before typing the new one
    kidNameElement.textContent = '';

    // Typing effect
    const typingInterval = setInterval(() => {
        if (index < message.length) {
            kidNameElement.textContent += message.charAt(index);
            index++;
        } else {
            clearInterval(typingInterval);
            cursorElement.style.display = 'none'; // Hide the cursor when typing is done

            // Delay before erasing
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

async function startNewChatSession() {
    try {
        const chatSessionsRef = collection(db, `parents/${parentId}/kids/${kidId}/chatSessions`);

        const chatSnapshot = await getDocs(chatSessionsRef);
        const nextChatNumber = chatSnapshot.size + 1;

        const newChatRef = doc(chatSessionsRef, `chat${nextChatNumber}`);
        await setDoc(newChatRef, {
            dateStarted: serverTimestamp(),
            chatNumber: nextChatNumber,
            kidName: kidName
        });

        currentChatSessionRef = collection(newChatRef, "messages");
        console.log(`Started new chat session: chat${nextChatNumber}`);

        //greetKid();
    } catch (error) {
        console.error("Error starting a new chat session:", error);
    }
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

async function sendMessage() {
    if (userTokens <= 0) {
        const resetTime = getNextResetTime();
        displayMessage(`Uh-oh! Looks like you've used up all your magic chat tokens for now! ✨ Don't worry, they'll be back soon! Come back at ${resetTime} and let's keep having fun! 🚀`, "bot");
        return;
    }

    const message = userInput.value.trim().toLowerCase();
    if (message === '') return;

    // If no chat session is active, start a new chat session.
    if (!currentChatSessionRef) {
        await startNewChatSession();
    }

    // Deduct one token for each message sent.
    userTokens--;
    updateTokenBar();

    // Update Firestore with the new token count immediately
    try {
        const userProfileRef = doc(db, `userProfiles/${parentId}`);
        await updateDoc(userProfileRef, { tokens: userTokens });
        console.log("Tokens updated in Firestore:", userTokens);
    } catch (error) {
        console.error("Error updating tokens in Firestore:", error);
    }

    displayMessage(message, 'user');
    userInput.value = '';

    await saveMessageToCurrentChat(message, 'user');
    conversationContext.push({ role: "user", content: message });

    try {
        displayTypingMessage("", 'typing'); // Cody starts thinking
        let response;

        response = await getChatResponse(); // Call text generation function
        displayTypingMessage(response, 'bot'); // Display text response

        removeTypingMessage(); // Cody is done thinking
        await saveMessageToCurrentChat(response, 'bot');
    } catch (error) {
        console.error("Error sending message:", error);
        removeTypingMessage();
        displayMessage("Oops! Something went wrong. Please try again later.", "bot");
    }
}

tokenInterval = setInterval(async () => {
    userTokens = isPremium ? 100 : 30;
    updateTokenBar();
    
    // Update Firestore
    try {
        const userProfileRef = doc(db, `userProfiles/${parentId}`);
        await updateDoc(userProfileRef, { tokens: userTokens });
    } catch (error) {
        console.error("Error resetting tokens in Firestore:", error);
    }
}, 60 * 60 * 1000); // Reset every hour.

function updateTokenBar() {
    const tokenBar = document.getElementById('token-bar');
    let tokenPercentage;

    if (isGold) {
        // For Gold users, hide the bar and set it to unlimited status
        tokenBar.style.width = "100%";
        tokenBar.style.backgroundColor = 'gold';
        document.getElementById("input-container").style.display = "block";
        return;
    }

    tokenPercentage = (userTokens / (isPremium ? 100 : 30)) * 100;
    tokenBar.style.width = `${tokenPercentage}%`;

    if (userTokens <= 0) {
        tokenBar.style.backgroundColor = 'red';
        document.getElementById("input-container").style.display = "none"; // Hide input container
        displayMessage(`Oopsie! Looks like you've used all your magic tokens for today! 🌟 But don't worry, they'll magically refill soon! Come back at ${getNextResetTime()} to keep the fun going! 🚀`, "bot");
    } else if (tokenPercentage < 20) {
        tokenBar.style.backgroundColor = 'orange';
    } else {
        tokenBar.style.backgroundColor = '#6a82fb'; // Default color
        document.getElementById("input-container").style.display = "block"; // Show input container
    }
}

function getNextResetTime() {
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0); // Set to the start of the next hour

    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    hours = hours ? hours : 12; // The hour '0' should be '12'

    return `${hours}:${minutes} ${ampm}`;
}

async function generateImage(prompt) {
    try {
        const response = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer YOUR_API_KEY_HERE` // Replace with your actual API key
            },
            body: JSON.stringify({
                prompt: prompt, // Use the provided prompt
                n: 1, // Number of images to generate
                size: "512x512" // Size of the generated image
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.data && data.data.length > 0) {
            const imageUrl = data.data[0].url;
            conversationContext.push({ role: "assistant", content: `[Image generated](${imageUrl})` });
            return imageUrl;
        } else {
            throw new Error("Image generation failed.");
        }
    } catch (error) {
        console.error("Error generating image:", error);
        return "Sorry, I couldn't generate an image. Please try again later.";
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
        await addDoc(currentChatSessionRef, {
            text: message,
            sender: sender,
            timestamp: serverTimestamp()
        });
        console.log(`Message saved: ${message} (Sender: ${sender})`);
    } catch (error) {
        console.error("Error saving message:", error);
    }
}

function displayMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = text;
    messageDiv.className = sender;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function displayTypingMessage(text, sender) {
    let index = 0;
    const messageDiv = document.createElement('div');
    messageDiv.className = sender;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Show the "Thinking..." message and disable the input field
    document.getElementById('thinking').style.display = 'block';
    userInput.disabled = true;
    sendBtn.disabled = true; // Disable send button

    const typingInterval = setInterval(() => {
        if (index < text.length) {
            messageDiv.textContent += text.charAt(index);
            index++;
        } else {
            clearInterval(typingInterval);
        }
    }, 30); //30 fast -- 100 slow
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

async function getChatResponse() {
    try {
        const response = await getChatResponseFunction({ prompt: conversationContext });
        const botResponse = response.data;  // Firebase returns the function result here
        conversationContext.push({ role: "assistant", content: botResponse });
        return botResponse;
    } catch (error) {
        console.error("Error getting chat response:", error);
        return "Oops! I couldn't process your message. Try again later.";
    }
}