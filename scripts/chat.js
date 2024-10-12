// chat.js

import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, setDoc, doc, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
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

// Get URL parameters to retrieve the selected kid's info
const urlParams = new URLSearchParams(window.location.search);
const kidId = urlParams.get('kidId');

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
            // Fetch kid data from the database before allowing messages
            fetchKidData().then(() => {
                // Add event listeners for sending messages
                sendBtn.addEventListener('click', sendMessage);
                userInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        sendMessage();
                    }
                });
            }).catch((error) => {
                console.error("Error fetching kid data:", error);
                displayMessage("Unable to load chat. Please try again later.", "bot");
            });
        } else {
            console.error("No user is signed in.");
            displayMessage("Please sign in to access the chat.", "bot");
            sendBtn.disabled = true;
        }
    });
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

            // Customize the conversation context based on age
            conversationContext = [
                { 
                    role: "system", 
                    content: `You are a friendly assistant talking to a kid named ${kidName} who is ${kidAge} years old. Use simple and short sentences, include emojis to make it fun 🎉, and avoid any inappropriate topics. Keep the conversation light and playful! 😊`
                },
                { 
                    role: "system", 
                    content: `When answering questions, be engaging and enthusiastic. Use emojis where appropriate, like ✨, 🚀, 🐶, 🏆. Keep your responses positive and friendly.`
                },
                { 
                    role: "system", 
                    content: `For difficult questions, explain in a way that is easy for a ${kidAge}-year-old to understand. Use examples or stories if it helps make the answer simpler.`
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

async function sendMessage() {
    const message = userInput.value.trim().toLowerCase(); // Convert to lowercase for easier comparison
    if (message === '') return;

    // If no chat session is active, start a new chat session
    if (!currentChatSessionRef) {
        await startNewChatSession();
    }

    displayMessage(message, 'user');
    userInput.value = '';

    await saveMessageToCurrentChat(message, 'user');
    conversationContext.push({ role: "user", content: message });

    try {
        displayMessage("Thinking...", 'typing');
        let response;

        // Commented out the code that detects image generation requests
        // const imageKeywords = ['generate image', 'generate an image', 'create image', 'make a picture', 'draw', 'illustrate', 'create an image'];
        // const isImageRequest = imageKeywords.some(keyword => message.includes(keyword));

        // if (isImageRequest) {
        //     const description = message.split(imageKeywords.find(keyword => message.includes(keyword)))[1].trim();
        //     response = await generateImage(description); // Call image generation function
        //     displayImage(response, 'bot'); // Display the image
        // } else {
            // Use GPT-3.5 for normal chat responses
            response = await getChatResponse(); // Call text generation function
            displayTypingMessage(response, 'bot'); // Display text response
        // }
        
        removeTypingMessage();
        await saveMessageToCurrentChat(response, 'bot');
    } catch (error) {
        console.error("Error sending message:", error);
        removeTypingMessage();
        displayMessage("Oops! Something went wrong. Please try again later.", "bot");
    }
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