// Import Firebase and necessary functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-functions.js";
import { getFirestore, doc, getDoc, updateDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDKhZZs3zN4AsRrv11YflMuj5MDasA6s0A",
    authDomain: "kids-chatgpt.firebaseapp.com",
    projectId: "kids-chatgpt",
    storageBucket: "kids-chatgpt.appspot.com",
    messagingSenderId: "432328053093",
    appId: "1:432328053093:web:59725efb514e0518cd918c",
    measurementId: "G-3XSXSF20Y3"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);
const db = getFirestore(app);
const auth = getAuth(app);
const getMathTutorResponse = httpsCallable(functions, 'getMathTutorResponse');

// Session state and default token values
let sessionMessages = [];
let userTokens = 5; // Default tokens, can be updated from Firestore
let parentId = null; // User ID, fetched once authenticated
let isPremium = false; // Initial premium status, updated from Firestore
let isGold = false; // Initial gold status, updated from Firestore

// Limits based on user type
const TOKEN_LIMITS = { free: 5, gold: 20, premium: 30 };

// UI updates for token bar
function updateTokenBar() {
    const tokenBar = document.getElementById('token-bar');
    const tokenCount = document.getElementById('token-count');
    const maxTokens = isPremium ? TOKEN_LIMITS.premium : (isGold ? TOKEN_LIMITS.gold : TOKEN_LIMITS.free);
    const tokenPercentage = (userTokens / maxTokens) * 100;
    
    tokenBar.style.width = `${tokenPercentage}%`; 
    tokenCount.textContent = `${userTokens} Tokens`;
}

// Fetch profile data, apply limits, and display badge
async function fetchUserTokens() {
    if (!parentId) return;
    const userProfileRef = doc(db, `userProfiles/${parentId}`);
    const userProfileSnapshot = await getDoc(userProfileRef);

    if (userProfileSnapshot.exists()) {
        const userData = userProfileSnapshot.data();
        isPremium = userData.isPremium || false;
        isGold = userData.isGold || false;

        if (userData.tokens > 0) {
            userTokens = userData.tokens;
        } else {
            userTokens = 0;
            // Use existing timestamp to calculate remaining time
            if (userData.tokensDepletedTimestamp) {
                const elapsedTime = Date.now() - userData.tokensDepletedTimestamp.toMillis();
                const refillInterval = 60 * 60 * 1000; // 1-hour interval

                if (elapsedTime >= refillInterval) {
                    await refillTokens(userProfileRef);
                } else {
                    displayTokenRefillCountdown(refillInterval - elapsedTime);
                }
            }
        }

        updateTokenBar();
        updateUserBadge(isGold, isPremium);
    } else {
        // If no profile exists, create one with default tokens
        await setDoc(userProfileRef, { tokens: TOKEN_LIMITS.free, isGold: false, isPremium: false });
        userTokens = TOKEN_LIMITS.free;
    }
}

// Deduct tokens and update in Firestore
async function deductToken() {
    if (userTokens > 0) {
        userTokens -= 1;
        await updateDoc(doc(db, `userProfiles/${parentId}`), { tokens: userTokens });
        updateTokenBar();
    }

    // Set the timestamp once when tokens hit zero
    if (userTokens === 0) {
        const userProfileRef = doc(db, `userProfiles/${parentId}`);
        const userProfileSnapshot = await getDoc(userProfileRef);

        // Only set the timestamp if it hasn't been set yet
        if (!userProfileSnapshot.data().tokensDepletedTimestamp) {
            console.warn("User has run out of tokens, setting depletion timestamp.");
            await updateDoc(userProfileRef, { tokensDepletedTimestamp: serverTimestamp() });
            displayTokenRefillCountdown(60 * 60 * 1000); // Start a 1-hour countdown
        }
    }
}

async function checkTokenRefillTime() {
    const userProfileRef = doc(db, `userProfiles/${parentId}`);
    const userProfileSnapshot = await getDoc(userProfileRef);
    const userProfile = userProfileSnapshot.data();

    const tokensDepletedTimestamp = userProfile.tokensDepletedTimestamp;
    const goldTokenLimit = 20;
    const premiumTokenLimit = 30;
    const freeTokenLimit = 5;

    // Check if tokens were depleted (i.e., if tokensDepletedTimestamp exists)
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
            await updateDoc(userProfileRef, {
                tokens: userTokens,
                tokensDepletedTimestamp: null // Clear the timestamp so it's only set again when tokens deplete
            });

            console.log("Tokens refilled after waiting the cooldown.");
            updateTokenBar(); // Update the UI to reflect the token refill
            return;
        }



    } else if (userTokens <= 0 && !tokensDepletedTimestamp) {
        // If tokens just ran out, set the depletion timestamp (only once when tokens run out)
        await updateDoc(userProfileRef, { tokensDepletedTimestamp: serverTimestamp() });
        console.log("Tokens depleted, timestamp saved.");

        // Manually calculate the time left (1 hour cooldown)
        const timeLeft = 60 * 60 * 1000;
        const minutesLeft = Math.floor(timeLeft / 60000);
        const secondsLeft = Math.floor((timeLeft % 60000) / 1000);
    }
}

async function refillTokens(userProfileRef) {
    userTokens = isPremium ? TOKEN_LIMITS.premium : (isGold ? TOKEN_LIMITS.gold : TOKEN_LIMITS.free);

    await updateDoc(userProfileRef, {
        tokens: userTokens,
        tokensDepletedTimestamp: null
    });

    // Hide the refill timer
    document.getElementById('refill-timer').style.display = "none";
    
    updateTokenBar();
    console.log("Tokens refilled after cooldown period.");
}

// Display remaining time for token refill
function displayTokenRefillCountdown(timeLeft) {
    const refillTimerDiv = document.getElementById('refill-timer');
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    
    // Set the countdown message
    refillTimerDiv.textContent = `🌟 Come back in ${minutes} minutes and ${seconds} seconds. 😊`;
    
    // Show the div if it's hidden
    refillTimerDiv.style.display = "block";
}


// Display badge based on user type
function updateUserBadge(isGold, isPremium) {
    const badgeElement = document.getElementById('user-badge');
    if (isGold) {
        badgeElement.textContent = "Gold 🏆";
        badgeElement.className = "badge gold";
    } else if (isPremium) {
        badgeElement.textContent = "Premium 💎";
        badgeElement.className = "badge premium";
    } else {
        badgeElement.textContent = "Free";
        badgeElement.className = "badge free";
    }
}

// Main function for sending math explanation requests
export async function getMathTutorExplanation() {
    const mathPrompt = document.getElementById('mathPrompt').value;
    const outputContainer = document.getElementById('outputContainer');

    if (userTokens <= 0) {
        outputContainer.innerHTML = "🌟 Oops! You're out of tokens! Wait for them to refill soon! 😊";
        return;
    }

    // Deduct token and update state
    await deductToken();
    outputContainer.innerHTML = "⏳ Loading explanation...";

    // Send message to session memory
    sessionMessages.push({ role: "user", content: mathPrompt });

    try {
        const response = await getMathTutorResponse({ mathPrompt, messages: sessionMessages });
        if (response.data && response.data.message) {
            sessionMessages.push({ role: "assistant", content: response.data.message });
            displayExplanation(response.data.message);
        } else {
            outputContainer.innerHTML = "No explanation received. Please try again.";
        }
    } catch (error) {
        outputContainer.innerHTML = `Error: ${error.message}`;
    }
}

// Display explanation with formatting for MathJax rendering
function displayExplanation(explanation) {
    const outputContainer = document.getElementById('outputContainer');
    outputContainer.innerHTML = "";

    const lines = explanation.split('\n');
    lines.forEach((line) => {
        const lineElement = document.createElement('div');
        lineElement.className = "step";

        line = line.replace(/\*\*(.*?)\*\*/g, '<strong class="emphasis">$1</strong>');
        line = line.replace(/\*(.*?)\*/g, '<em>$1</em>');
        line = line.replace(/\\\[(.*?)\\\]/g, (_, expr) => `\\[${expr}\\]`);
        line = line.replace(/\\\((.*?)\\\)/g, (_, expr) => `\\(${expr}\\)`);

        lineElement.innerHTML = line.startsWith("```") && line.endsWith("```")
            ? `<pre><code>${line.slice(3, -3).trim()}</code></pre>`
            : line;
        outputContainer.appendChild(lineElement);
    });
    MathJax.typesetPromise([outputContainer]).catch((err) => {
        outputContainer.innerHTML += "<div class='error'>There was an issue rendering math symbols. Please try again.</div>";
    });
}

// Request a simpler explanation
export async function requestSimplerExplanation() {
    if (userTokens <= 0) {
        document.getElementById('outputContainer').innerHTML = "🌟 Out of tokens! Wait for refill 😊";
        return;
    }
    sessionMessages.push({ role: "user", content: "Could you explain it more simply in steps?" });
    await deductToken();
    await getMathTutorExplanation();
}

// Ask follow-up question with memory
export async function askFollowUpQuestion() {
    const followUpQuestion = document.getElementById('followUpQuestion').value;
    const outputContainer = document.getElementById('outputContainer');
    
    if (!followUpQuestion) return;

    if (userTokens <= 0) {
        outputContainer.innerHTML = "🌟 Out of tokens! Wait for refill 😊";
        return;
    }

    sessionMessages.push({ role: "user", content: `Follow-up: ${followUpQuestion}` });
    document.getElementById('followUpQuestion').value = "";
    await deductToken();
    await getMathTutorExplanation();
}

// Monitor authentication and initialize
onAuthStateChanged(auth, async (user) => {
    if (user) {
        parentId = user.uid;
        await fetchUserTokens(); // Fetch tokens only if the user is logged in
        await checkTokenRefillTime(); // Check token refill status on load
    } else {
        console.error("User is not logged in. Redirecting to login page...");
        window.location.href = 'https://alfieaikids.fun/login';
    }
});

// Make functions accessible to the UI
window.getMathTutorExplanation = getMathTutorExplanation;
window.requestSimplerExplanation = requestSimplerExplanation;
window.askFollowUpQuestion = askFollowUpQuestion;
