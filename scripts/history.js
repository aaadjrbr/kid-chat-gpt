import { db } from './firebase-config.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

const botName = "Friendly Robot";
let kidName = "User";

// Fetch `kidName` from URL params or Firestore (if applicable)
function getKidNameFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('kidName') || "User"; // Set "User" as fallback, if `kidName` isn't in the URL
}

// Fetch chat sessions for a specific day within the current month and cache them
export async function displayChatHistoryByDay(parentId, kidId, year, month, day) {
    kidName = getKidNameFromURL();  

    // Convert the selected day to a start and end timestamp
    const startOfDay = new Date(`${year}-${month}-${String(day).padStart(2, '0')}T00:00:00`);
    const endOfDay = new Date(`${year}-${month}-${String(day).padStart(2, '0')}T23:59:59`);

    const chatSessionsRef = collection(db, `parents/${parentId}/kids/${kidId}/chatSessions`);
    
    // Query for chats that started between the start and end of the day
    const q = query(
        chatSessionsRef,
        where("dateStarted", ">=", startOfDay),
        where("dateStarted", "<=", endOfDay),
        orderBy("dateStarted", "desc")
    );

    const chatSnapshot = await getDocs(q);
    const historyContainer = document.getElementById('history-container');
    historyContainer.innerHTML = ''; // Clear previous results

    if (chatSnapshot.empty) {
        historyContainer.innerHTML += '<p>❌ No chat history available for this day.</p>';
        return;
    }

    // Store the sessions in cache (by day)
    const chatSessions = chatSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
    const cacheKey = `${parentId}_${kidId}_${year}_${month}_${day}`;
    sessionStorage.setItem(cacheKey, JSON.stringify(chatSessions));

    // Display the fetched sessions
    renderChatHistory(chatSessions, parentId, kidId, year, month, day);
}


// Function to load chat messages for a specific chat session
async function loadChatMessages(parentId, kidId, chatId, year, month, day) {
    kidName = getKidNameFromURL();  // Ensure kidName is set before rendering messages

    console.log(`Fetching messages for chatId: ${chatId}`);
    const messagesRef = collection(db, `parents/${parentId}/kids/${kidId}/chatSessions/${chatId}/messages`);

    const q = query(messagesRef, orderBy("timestamp"));
    const messagesSnapshot = await getDocs(q);

    const historyContainer = document.getElementById('history-container');
    historyContainer.innerHTML = ''; // Clear previous results

    // Add the "Go Back" button to go back to the list of sessions for the same day (Add this first)
    const goBackButton = document.createElement('button');
    goBackButton.textContent = "Go Back";
    goBackButton.classList.add('go-back-button');
    goBackButton.addEventListener('click', () => {
        const cacheKey = `${parentId}_${kidId}_${year}_${month}_${day}`;
        const cachedData = sessionStorage.getItem(cacheKey);
        if (cachedData) {
            console.log("Using cached data to go back.");
            renderChatHistory(JSON.parse(cachedData), parentId, kidId, year, month, day);
        }
    });

    historyContainer.appendChild(goBackButton); // Add the button to the top

    // Update header to indicate the selected day
    const historyHeader = document.createElement('h3');
    historyHeader.textContent = `💬 Chat messages for ${month}/${day}/${year}`;
    historyContainer.appendChild(historyHeader);

    const messagesContainer = document.createElement('div');
    messagesContainer.classList.add('messages-container');

    const messagesList = document.createElement('ul');
    if (messagesSnapshot.empty) {
        historyContainer.innerHTML += '<p>❌ No messages found for this chat session.</p>';
    } else {
        messagesSnapshot.forEach(doc => {
            const msg = doc.data();
            const senderName = msg.sender === 'bot' ? botName : kidName; // Use kidName instead of "User"

            const msgItem = document.createElement('li');
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
                // Display text message with senderName
                msgItem.textContent = `${senderName}: ${msg.text}`;
            }

            messagesList.appendChild(msgItem);
        });
        messagesContainer.appendChild(messagesList);
    }

    historyContainer.appendChild(messagesContainer);
}

// Function to render the chat history from cache or query
function renderChatHistory(chatSessions, parentId, kidId, year, month, day) {
    const historyContainer = document.getElementById('history-container');
    historyContainer.innerHTML = ''; // Clear previous results

    const historyHeader = document.createElement('h3');
    historyHeader.textContent = `💬 Chat history for ${month}/${day}/${year}`;
    historyContainer.appendChild(historyHeader);

    const sessionsContainer = document.createElement('div');
    sessionsContainer.classList.add('sessions-container');

    const sessionsList = document.createElement('ul');
    chatSessions.forEach(session => {
        const sessionItem = document.createElement('li');
        const sessionTime = new Date(session.dateStarted.seconds * 1000).toLocaleTimeString();
        sessionItem.textContent = `Chat started at ${sessionTime}`;
        sessionItem.addEventListener('click', () => {
            loadChatMessages(parentId, kidId, session.id, year, month, day); 
        });
        sessionsList.appendChild(sessionItem);
    });

    sessionsContainer.appendChild(sessionsList);
    historyContainer.appendChild(sessionsContainer);
}

