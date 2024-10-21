import { db } from './firebase-config.js';
import { collection, getDocs, query, where, orderBy, limit, startAfter } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

const botName = "🐶 Alfie";
let kidName = "User";

// Fetch `kidName` from URL params or Firestore (if applicable)
function getKidNameFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('kidName') || "User"; // Set "User" as fallback, if `kidName` isn't in the URL
}

// Fetch chat sessions for a specific day within the current month and cache them
const SESSIONS_PER_PAGE = 5; // Number of chat sessions per page
let lastVisible = null; // Store the last visible document for pagination

// Fetch chat sessions for a specific day with pagination
export async function displayChatHistoryByDay(parentId, kidId, year, month, day, page = 1) {
    kidName = getKidNameFromURL();  

    // Convert the selected day to a start and end timestamp
    const startOfDay = new Date(`${year}-${month}-${String(day).padStart(2, '0')}T00:00:00`);
    const endOfDay = new Date(`${year}-${month}-${String(day).padStart(2, '0')}T23:59:59`);

    const chatSessionsRef = collection(db, `parents/${parentId}/kids/${kidId}/chatSessions`);
    
    let q = query(
        chatSessionsRef,
        where("dateStarted", ">=", startOfDay),
        where("dateStarted", "<=", endOfDay),
        orderBy("dateStarted", "desc"),
        limit(SESSIONS_PER_PAGE + 1) // Fetch one extra session to check if more exist
    );

    // If this is not the first page, start after the last visible document from the previous page
    if (page > 1 && lastVisible) {
        q = query(q, startAfter(lastVisible));
    }

    // Execute the query
    const chatSnapshot = await getDocs(q);
    const historyContainer = document.getElementById('history-container');
    historyContainer.innerHTML = ''; // Clear previous results

    if (chatSnapshot.empty) {
        historyContainer.innerHTML += '<p>❌ No chat history available for this day.</p>';
        return;
    }

    // Update lastVisible for pagination
    if (chatSnapshot.docs.length > SESSIONS_PER_PAGE) {
        lastVisible = chatSnapshot.docs[SESSIONS_PER_PAGE - 1]; // Set lastVisible for pagination
    } else {
        lastVisible = null; // No more sessions, disable next button
    }

    // Get only the first `SESSIONS_PER_PAGE` items
    const chatSessions = chatSnapshot.docs.slice(0, SESSIONS_PER_PAGE).map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    // Cache the data for future use
    const cacheKey = `${parentId}_${kidId}_${year}_${month}_${day}`;
    sessionStorage.setItem(cacheKey, JSON.stringify(chatSessions));

    // Display the fetched sessions
    renderChatHistory(chatSessions, parentId, kidId, year, month, day, page);
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
        
            // Create a span for the sender name
            const senderSpan = document.createElement('span');
            senderSpan.textContent = `${senderName}: `;
        
            // Add a specific class to the bot's name
            if (msg.sender === 'bot') {
                senderSpan.classList.add('bot-name'); // Add class for the bot's name
            }
        
            // Check if the message contains an image URL
            if (msg.imageUrl) {
                const imageElement = document.createElement('img');
                imageElement.src = msg.imageUrl;
                imageElement.alt = "Image";
                imageElement.style.maxWidth = "100%";
                imageElement.style.borderRadius = "8px";
        
                // Add error handling for broken images
                imageElement.onerror = function () {
                    imageElement.style.display = 'none'; // Hide broken image
                    const errorMessage = document.createElement('p');
                    errorMessage.textContent = "Image deleted/not found.";
                    msgItem.appendChild(errorMessage); // Display the error message
                };
        
                msgItem.appendChild(senderSpan);
                msgItem.appendChild(imageElement);
            } else if (msg.text) {
                // Append sender name and text message separately
                msgItem.appendChild(senderSpan);
                msgItem.appendChild(document.createTextNode(msg.text));
            }
        
            messagesList.appendChild(msgItem);
        });        
        messagesContainer.appendChild(messagesList);
    }
    
    historyContainer.appendChild(messagesContainer);
}    

// Function to render the chat history from cache or query
let currentPage = 1; // Start from the first page

// Function to render the chat history with pagination
function renderChatHistory(chatSessions, parentId, kidId, year, month, day, page) {
    currentPage = page;
    const historyContainer = document.getElementById('history-container');
    historyContainer.innerHTML = ''; // Clear previous results

    const historyHeader = document.createElement('h3');
    historyHeader.textContent = `💬 Chat history for ${month}/${day}/${year} (Page ${currentPage})`;
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

    // Add pagination buttons
    const paginationContainer = document.createElement('div');
    paginationContainer.classList.add('pagination-container');

    // Display "Previous" button only if we're not on the first page
    if (currentPage > 1) {
        const prevButton = document.createElement('button');
        prevButton.textContent = '< Previous';
        prevButton.addEventListener('click', () => {
            currentPage--;
            displayChatHistoryByDay(parentId, kidId, year, month, day, currentPage); // Fetch previous page
        });
        paginationContainer.appendChild(prevButton);
    }

    // Display "Next" button only if there are more sessions to load
    if (lastVisible) {
        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next >';
        nextButton.addEventListener('click', () => {
            currentPage++;
            displayChatHistoryByDay(parentId, kidId, year, month, day, currentPage); // Fetch next page
        });
        paginationContainer.appendChild(nextButton);
    }

    // Only append pagination if we have at least one button
    if (paginationContainer.children.length > 0) {
        historyContainer.appendChild(paginationContainer);
    }
}