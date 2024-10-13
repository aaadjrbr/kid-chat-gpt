import { db } from './firebase-config.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

const botName = "Friendly Robot";
let kidName = "User";

// Cache key for session storage
const CACHE_KEY = "chatHistoryCache";

// Fetch chat sessions for a specific day within the current month and cache them
export async function displayChatHistoryByDay(parentId, kidId, year, month, day) {
    console.log(`Fetching chat sessions for parentId: ${parentId}, kidId: ${kidId}, Year: ${year}, Month: ${month}, Day: ${day}`);

    // Check if the data is already in the session cache
    const cacheKey = `${parentId}_${kidId}_${year}_${month}_${day}`;
    const cachedData = sessionStorage.getItem(cacheKey);
    
    if (cachedData) {
        console.log("Using cached data for chat sessions.");
        renderChatHistory(JSON.parse(cachedData), parentId, kidId, year, month, day);
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    kidName = urlParams.get('kidName') || "User";

    const chatSessionsRef = collection(db, `parents/${parentId}/kids/${kidId}/chatSessions`);
    const startOfDay = new Date(`${year}-${month}-${String(day).padStart(2, '0')}T00:00:00`);
    const endOfDay = new Date(`${year}-${month}-${String(day).padStart(2, '0')}T23:59:59`);

    // Query chat sessions for the specific day
    const q = query(
        chatSessionsRef,
        where("dateStarted", ">=", startOfDay),
        where("dateStarted", "<=", endOfDay),
        orderBy("dateStarted", "desc")
    );

    const chatSnapshot = await getDocs(q);
    if (!chatSnapshot.empty) {
        // Save chat data to the cache
        const chatSessions = chatSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        sessionStorage.setItem(cacheKey, JSON.stringify(chatSessions));
        console.log("Caching chat sessions for this day.");

        // Render chat history after caching
        renderChatHistory(chatSessions, parentId, kidId, year, month, day);
    } else {
        const historyContainer = document.getElementById('history-container');
        historyContainer.innerHTML = '<p>No chat history available for this day.</p>';
    }
}

// Function to render the chat history from the cache or query
function renderChatHistory(chatSessions, parentId, kidId, year, month, day) {
    const historyContainer = document.getElementById('history-container');
    historyContainer.innerHTML = ''; // Clear previous results

    const historyHeader = document.createElement('h3');
    historyHeader.textContent = `Chat history for ${month}/${day}/${year}`;
    historyContainer.appendChild(historyHeader);

    const sessionsContainer = document.createElement('div');
    sessionsContainer.classList.add('sessions-container');

    const sessionsList = document.createElement('ul');
    chatSessions.forEach(session => {
        const sessionItem = document.createElement('li');
        const sessionTime = new Date(session.dateStarted.seconds * 1000).toLocaleTimeString();
        sessionItem.textContent = `Chat started at ${sessionTime}`;
        sessionItem.addEventListener('click', () => {
            loadChatMessages(parentId, kidId, session.id, year, month, day); // Pass parentId, kidId correctly here
        });
        sessionsList.appendChild(sessionItem);
    });

    sessionsContainer.appendChild(sessionsList);
    historyContainer.appendChild(sessionsContainer);
}

// Function to load chat messages for a specific chat session
async function loadChatMessages(parentId, kidId, chatId, year, month, day) {
    console.log(`Fetching messages for chatId: ${chatId}`);
    const messagesRef = collection(db, `parents/${parentId}/kids/${kidId}/chatSessions/${chatId}/messages`);

    const q = query(messagesRef, orderBy("timestamp"));
    const messagesSnapshot = await getDocs(q);

    const historyContainer = document.getElementById('history-container');
    historyContainer.innerHTML = ''; // Clear previous results

    // Update header to indicate the selected day
    const historyHeader = document.createElement('h3');
    historyHeader.textContent = `Chat messages for ${month}/${day}/${year}`;
    historyContainer.appendChild(historyHeader);

    const messagesContainer = document.createElement('div');
    messagesContainer.classList.add('messages-container');

    const messagesList = document.createElement('ul');
    if (messagesSnapshot.empty) {
        historyContainer.innerHTML += '<p>No messages found for this chat session.</p>';
    } else {
        messagesSnapshot.forEach(doc => {
            const msg = doc.data();
            const msgItem = document.createElement('li');
            const senderName = msg.sender === 'bot' ? botName : kidName;

            msgItem.classList.add(msg.sender === 'bot' ? 'bot-message' : 'user-message');

            // Check if the message contains a URL that looks like an image
            if (msg.text.startsWith("http") && (msg.text.includes(".png") || msg.text.includes(".jpg") || msg.text.includes(".jpeg"))) {
                const imageElement = document.createElement('img');
                imageElement.src = msg.text;
                imageElement.alt = "Image";
                imageElement.style.maxWidth = "100%";
                imageElement.style.borderRadius = "8px";
                msgItem.appendChild(imageElement);
            } else {
                // Display text message
                msgItem.textContent = `${senderName}: ${msg.text}`;
            }

            messagesList.appendChild(msgItem);
        });
        messagesContainer.appendChild(messagesList);
    }

    historyContainer.appendChild(messagesContainer);

    // Add the "Go Back" button to go back to the list of sessions for the same day
    const goBackButton = document.createElement('button');
    goBackButton.textContent = "Go Back";
    goBackButton.classList.add('go-back-button');
    goBackButton.addEventListener('click', () => {
        // Re-render the chat sessions for the same day from cache
        const cacheKey = `${parentId}_${kidId}_${year}_${month}_${day}`;
        const cachedData = sessionStorage.getItem(cacheKey);
        if (cachedData) {
            console.log("Using cached data to go back.");
            renderChatHistory(JSON.parse(cachedData), parentId, kidId, year, month, day);
        }
    });

    historyContainer.appendChild(goBackButton);
}
