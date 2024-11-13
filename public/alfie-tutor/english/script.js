import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-functions.js";
// Import Firebase and necessary functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
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

let mediaRecorder;
let audioChunks = [];
let tutorFeedbackAudioUrl = '';
let pronunciationFeedbackAudioUrl = '';
let isPlaying = false; // Flag to check if audio is playing
let isProcessing = false; // Flag to check if processing is in progress
let mediaStream; // Define a global variable for the stream
let tutorFeedbackText = '';  // Add a variable to store the feedback text
let pronunciationFeedbackText = '';
let pronunciationAudio = null; // Store the pronunciation audio object

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
// Fetch profile data, apply limits, and display badge
async function fetchUserTokens() {
    if (!parentId) return;
    const userProfileRef = doc(db, `userProfiles/${parentId}`);
    const userProfileSnapshot = await getDoc(userProfileRef);

    // Set up a flag to track if any fields were missing and need to be added
    let updateNeeded = false;

    if (userProfileSnapshot.exists()) {
        const userData = userProfileSnapshot.data();

        // Check and set defaults if fields are missing
        if (userData.tokens === undefined) {
            userTokens = TOKEN_LIMITS.free;
            updateNeeded = true;
        } else {
            userTokens = userData.tokens;
        }

        if (userData.isPremium === undefined) {
            isPremium = false;
            updateNeeded = true;
        } else {
            isPremium = userData.isPremium;
        }

        if (userData.isGold === undefined) {
            isGold = false;
            updateNeeded = true;
        } else {
            isGold = userData.isGold;
        }

        // Update Firestore if any fields were missing
        if (updateNeeded) {
            await updateDoc(userProfileRef, {
                tokens: userTokens,
                isPremium: isPremium,
                isGold: isGold
            });
        }

        // Handle token refill timing if tokens are depleted
        if (userTokens <= 0 && userData.tokensDepletedTimestamp) {
            const elapsedTime = Date.now() - userData.tokensDepletedTimestamp.toMillis();
            const refillInterval = 60 * 60 * 1000; // 1-hour interval

            if (elapsedTime >= refillInterval) {
                await refillTokens(userProfileRef);
            } else {
                displayTokenRefillCountdown(refillInterval - elapsedTime);
            }
        }
    } else {
        // If no profile exists, create one with default tokens and permissions
        await setDoc(userProfileRef, { tokens: TOKEN_LIMITS.free, isGold: false, isPremium: false });
        userTokens = TOKEN_LIMITS.free;
        isPremium = false;
        isGold = false;
    }

    // Update UI elements for token bar and badge display
    updateTokenBar();
    updateUserBadge(isGold, isPremium);
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
    refillTimerDiv.textContent = `🌟 Out of tokens! Upgrade for more or come back in ${minutes} minutes and ${seconds} seconds. 😊`;
    
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

// Function to call the English Tutor for syllable breakdown and pronunciation
let wordToPronounce = ''; // Add a global variable to store the word for pronunciation

async function callEnglishTutor() {
    const wordInputElement = document.getElementById("word-input");
    const wordInput = wordInputElement.value.trim(); // Trim input to remove extra spaces
    const englishOutput = document.getElementById("english-output");
    const playTutorFeedbackButton = document.getElementById("play-tutor-feedback");
    const playPronunciationFeedbackButton = document.getElementById("play-pronunciation-feedback");
    const playWordPronunciationButton = document.getElementById("play-word-pronunciation");

    // Validate input
    if (!wordInput) {
        englishOutput.textContent = "Please enter a word or phrase to analyze.";
        console.warn("Input is empty. Cannot proceed with analysis.");
        return;
    }

    // Clear previous feedback and audio data
    pronunciationFeedbackText = '';
    pronunciationFeedbackAudioUrl = '';
    tutorFeedbackText = '';
    wordToPronounce = '';
    isPlaying = false;

    // Hide buttons for outdated feedback
    playTutorFeedbackButton.classList.add("hidden");
    playPronunciationFeedbackButton.classList.add("hidden");
    playWordPronunciationButton.classList.add("hidden");

    // Check if there are tokens available
    if (userTokens <= 0) {
        const userProfileRef = doc(db, `userProfiles/${parentId}`);
        const userProfileSnapshot = await getDoc(userProfileRef);
        const tokensDepletedTimestamp = userProfileSnapshot.data()?.tokensDepletedTimestamp;

        if (tokensDepletedTimestamp) {
            const elapsedTime = Date.now() - tokensDepletedTimestamp.toMillis();
            const refillInterval = 60 * 60 * 1000; // 1 hour
            const timeLeft = refillInterval - elapsedTime;

            const minutes = Math.floor(timeLeft / 60000);
            const seconds = Math.floor((timeLeft % 60000) / 1000);
            englishOutput.textContent = `🌟 Out of tokens! Come back in ${minutes} minutes and ${seconds} seconds or upgrade for more tokens.`;
        } else {
            englishOutput.textContent = "🌟 Out of tokens! Please wait or upgrade for more tokens.";
        }
        return;
    }

    // Deduct a token
    await deductToken();

    // Reset outputs and buttons
    englishOutput.textContent = "⏳ Loading...";
    isProcessing = true;

    const getEnglishTutorResponse = httpsCallable(functions, 'getEnglishTutorResponse');
    try {
        const response = await getEnglishTutorResponse({ wordPrompt: wordInput });
        console.log("Response from English Tutor:", response.data);

        // Introduce a slight delay to ensure the response is processed before updating UI
        await new Promise((resolve) => setTimeout(resolve, 300)); // 300ms delay

        // Set the output text
        englishOutput.textContent = response.data.message || "No response received.";

        // Extract the first word (entire word from AI response)
        const matches = response.data.message?.match(/The word: ["']([^"']+)["']/);
        wordToPronounce = matches ? matches[1] : null;

        if (wordToPronounce) {
            console.log("Extracted word to pronounce:", wordToPronounce);
            playWordPronunciationButton.classList.remove("hidden");
        }

        // Show appropriate feedback buttons based on response type
        if (response.data.isGrammarFeedback) {
            tutorFeedbackText = response.data.message;
            console.log("Tutor Feedback Text Set:", tutorFeedbackText);
            playTutorFeedbackButton.classList.remove("hidden");
        } else if (response.data.plainTextSyllables) {
            pronunciationFeedbackText = response.data.plainTextSyllables;
            console.log("Pronunciation Feedback Text Set:", pronunciationFeedbackText);
            playPronunciationFeedbackButton.classList.remove("hidden");
        }
    } catch (error) {
        console.error("Error calling English Tutor:", error);

        // Handle specific errors
        if (error.message.includes("wordPrompt is missing")) {
            englishOutput.textContent = "Error: The input was not sent correctly. Please try again.";
        } else {
            englishOutput.textContent = "Error: Could not fetch syllable breakdown.";
        }
    } finally {
        isProcessing = false;
        wordInputElement.value = ""; // Clear input field
    }
}

let isPlayingPronunciation = false; // Flag to check if audio is playing

async function playWordPronunciation() {
    if (!wordToPronounce) return;

    if (isPlayingPronunciation) {
        console.warn("Audio is already playing.");
        return; // Prevent replay if the audio is already playing
    }

    const generatePronunciationFeedback = httpsCallable(functions, 'generatePronunciationFeedback');
    try {
        // Remove irrelevant prefixes before sending to the audio generator
        let cleanText = wordToPronounce.replace(/^(Pronunciation guide:|Grammar suggestion:)\s*/i, "").trim();

        const audioResponse = await generatePronunciationFeedback({ text: cleanText });
        pronunciationAudio = new Audio(audioResponse.data);

        // Set the flag and add an event listener to reset it when playback ends
        isPlayingPronunciation = true;
        pronunciationAudio.play();
        pronunciationAudio.onended = () => {
            isPlayingPronunciation = false; // Reset flag when audio finishes playing
        };
    } catch (error) {
        console.error("Error playing word pronunciation:", error);
        isPlayingPronunciation = false; // Reset flag on error
    }
}

async function makeItSimpler() {
    const englishOutput = document.getElementById("english-output");
    const existingFeedback = englishOutput.textContent;

    // If there's no feedback yet, do nothing
    if (!existingFeedback || existingFeedback === "⏳ Loading...") {
        englishOutput.textContent = "Please get an answer first before simplifying.";
        return;
    }

    // Call the function to simplify the feedback
    const simplifyResponse = httpsCallable(functions, 'getEnglishTutorResponse');
    try {
        const response = await simplifyResponse({
            wordPrompt: `Make this simpler: ${existingFeedback}`
        });

        const simplifiedText = response.data.message;

        // Update the UI with the simplified text
        englishOutput.textContent = simplifiedText;

        // Update the relevant text variables for audio playback
        if (pronunciationFeedbackText.includes(existingFeedback)) {
            pronunciationFeedbackText = simplifiedText;
        } else if (tutorFeedbackText.includes(existingFeedback)) {
            tutorFeedbackText = simplifiedText;
        }

        console.log("Text simplified and updated for playback:", simplifiedText);
    } catch (error) {
        console.error("Error simplifying feedback:", error);
        englishOutput.textContent = "Error: Could not simplify the feedback.";
    }
}

// Countdown function for recording
function showCountdown(callback) {
    const englishOutput = document.getElementById("english-output");
    englishOutput.textContent = "Recording in: 3";
    let countdown = 2;

    const interval = setInterval(() => {
        englishOutput.textContent = `Recording in: ${countdown}`;
        countdown -= 1;
        if (countdown < 0) {
            clearInterval(interval);
            englishOutput.textContent = "Listening...";
            callback(); // Start recording after countdown
        }
    }, 1000);
}

// Function to start recording with countdown and visual feedback
function startRecording() {
    if (isProcessing) return;

    const wordInput = document.getElementById("word-input").value;
    if (!wordInput) {
        document.getElementById("english-output").textContent = "Please enter a word to analyze before recording.";
        return;
    }

    document.getElementById("play-tutor-feedback").classList.add("hidden");
    document.getElementById("play-pronunciation-feedback").classList.add("hidden");
    document.getElementById("record-button").disabled = true;
    document.getElementById("stop-button").disabled = false;

    showCountdown(() => {
        audioChunks = [];
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                mediaStream = stream; // Store the stream
                mediaRecorder = new MediaRecorder(stream, { mimeType: getMimeType() });
                mediaRecorder.start();
                mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
            })
            .catch(error => {
                console.error("Error accessing microphone:", error);
                alert("Microphone access is required for recording.");
                resetButtons();
            });
    });
}

function getMimeType() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    return isIOS ? "audio/mp4" : "audio/webm";
}

// Function to stop recording and release microphone
async function stopRecording() {
    if (!mediaRecorder) return;

    mediaRecorder.stop();
    resetButtons();
    document.getElementById("english-output").textContent = "🎤 Checking speech...";
    isProcessing = true;

    mediaRecorder.onstop = async () => {
        // Stop all tracks to release the microphone
        mediaStream.getTracks().forEach(track => track.stop());

        // Combine the audio chunks into a Blob
        let audioBlob = audioChunks.length > 0 && audioChunks[0].type === "audio/webm"
            ? new Blob(audioChunks, { type: "audio/webm" })
            : new Blob(audioChunks, { type: "audio/mp4" });

        // Convert the Blob to Base64 for processing
        const audioBase64 = await convertBlobToBase64(audioBlob);
        const wordInput = document.getElementById("word-input").value;

        const whisperTranscription = httpsCallable(functions, 'generatePronunciationPractice');

        try {
            // Send the recording to the backend for processing
            const response = await whisperTranscription({ word: wordInput, userAudioBase64: audioBase64 });

            // Update the output with feedback text
            document.getElementById("english-output").textContent = response.data.feedback;

            // Fetch the audio URL for pronunciation feedback
            const generatePronunciationFeedback = httpsCallable(functions, 'generatePronunciationFeedback');
            const pronunciationAudioResponse = await generatePronunciationFeedback({ text: response.data.feedback });
            
            // Update the global audio URL for playback
            pronunciationFeedbackAudioUrl = pronunciationAudioResponse.data;

            // Make the "Listen" button visible
            document.getElementById("play-pronunciation-feedback").classList.remove("hidden");
        } catch (error) {
            console.error("Error processing recording:", error);
            document.getElementById("english-output").textContent = "Error: Could not process your recording.";
        } finally {
            isProcessing = false;
        }
    };
}

// Initialize SpeechRecognition (make sure this is available in supported browsers only)
let recognition;
let isRecognitionActive = false; // Track if recognition is active

if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
        isRecognitionActive = true;
    };

    recognition.onend = () => {
        isRecognitionActive = false;
        const wordInput = document.getElementById("word-input");
        wordInput.classList.remove("recording");
        console.log("Speech recognition ended");
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        isRecognitionActive = false; // Reset on error
    };
} else {
    console.warn("Speech recognition is not supported in this browser.");
}

function startSpeechRecognition() {
    const wordInput = document.getElementById("word-input");

    if (recognition && !isRecognitionActive) { // Check if not already active
        recognition.start();
        isRecognitionActive = true; // Set active state
        wordInput.classList.add("recording");

        recognition.onresult = (event) => {
            wordInput.value = event.results[0][0].transcript; // Set recognized text in input
            recognition.stop(); // Stop after capturing the result
        };

        recognition.onend = () => {
            isRecognitionActive = false; // Reset active state
            wordInput.classList.remove("recording"); // Clear UI indication
            console.log("Speech recognition ended and microphone released.");
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            isRecognitionActive = false; // Reset active state on error
            wordInput.classList.remove("recording"); // Clear UI indication
        };
    } else if (!recognition) {
        alert("Speech recognition is not supported in this browser.");
    }
}

let tutorAudio = null; // Store the tutor feedback audio object

// Function to play the tutor feedback audio with a pause/stop option
async function playTutorFeedback() {
    if (!tutorFeedbackText || isPlaying) return;

    const generateSpeechFunction = httpsCallable(functions, 'generateSlowSpeech');
    try {
        // Clean text by removing irrelevant prefixes
        let cleanText = tutorFeedbackText.replace(/^(Pronunciation guide:|Grammar suggestion:)\s*/i, "").trim();

        const audioResponse = await generateSpeechFunction({ text: cleanText });
        tutorAudio = new Audio(audioResponse.data);

        // Set the flag and show the pause button
        isPlaying = true;
        document.getElementById("pause-tutor-feedback").classList.remove("hidden");

        tutorAudio.play();
        tutorAudio.onended = () => {
            isPlaying = false; // Reset flag when audio finishes playing
            document.getElementById("pause-tutor-feedback").classList.add("hidden");
        };
    } catch (error) {
        console.error("Error generating tutor feedback audio:", error);
        isPlaying = false; // Reset flag on error
    }
}

// Function to pause or stop the tutor feedback
function pauseTutorFeedback() {
    if (tutorAudio && !tutorAudio.paused) {
        tutorAudio.pause();
        isPlaying = false;
        document.getElementById("pause-tutor-feedback").classList.add("hidden");
    }
}

// Function to play the pronunciation feedback audio with a pause/stop option
async function playPronunciationFeedback() {
    if ((!pronunciationFeedbackText && !pronunciationFeedbackAudioUrl) || isPlaying) return;

    try {
        // If `pronunciationFeedbackAudioUrl` exists, play the user-generated audio
        if (pronunciationFeedbackAudioUrl) {
            pronunciationAudio = new Audio(pronunciationFeedbackAudioUrl);

            // Set the flag and show the pause button
            isPlaying = true;
            document.getElementById("pause-pronunciation-feedback").classList.remove("hidden");

            pronunciationAudio.play();
            pronunciationAudio.onended = () => {
                isPlaying = false; // Reset flag when audio finishes playing
                document.getElementById("pause-pronunciation-feedback").classList.add("hidden");
            };

            console.log("Playing user-generated pronunciation feedback audio.");
            return;
        }

        // If no URL but `pronunciationFeedbackText` exists, generate audio dynamically
        const generatePronunciationFeedback = httpsCallable(functions, 'generatePronunciationFeedback');
        let cleanText = pronunciationFeedbackText.replace(/^(Pronunciation guide:|Grammar suggestion:)\s*/i, "").trim();

        const audioResponse = await generatePronunciationFeedback({ text: cleanText });
        pronunciationAudio = new Audio(audioResponse.data);

        // Set the flag and show the pause button
        isPlaying = true;
        document.getElementById("pause-pronunciation-feedback").classList.remove("hidden");

        pronunciationAudio.play();
        pronunciationAudio.onended = () => {
            isPlaying = false; // Reset flag when audio finishes playing
            document.getElementById("pause-pronunciation-feedback").classList.add("hidden");
        };

        console.log("Playing dynamically generated pronunciation feedback audio.");
    } catch (error) {
        console.error("Error playing pronunciation feedback audio:", error);
        isPlaying = false; // Reset flag on error
    }
}

// Function to pause or stop the pronunciation feedback
function pausePronunciationFeedback() {
    if (pronunciationAudio && !pronunciationAudio.paused) {
        pronunciationAudio.pause();
        isPlaying = false;
        document.getElementById("pause-pronunciation-feedback").classList.add("hidden");
    }
}

// Helper function to reset button states
function resetButtons() {
    document.getElementById("record-button").disabled = false;
    document.getElementById("stop-button").disabled = true;
    document.getElementById("listening-message").style.display = "none";
}

// Helper function to convert audio blob to base64
function convertBlobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
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

// Make functions accessible globally
window.callEnglishTutor = callEnglishTutor;
window.startRecording = startRecording;
window.stopRecording = stopRecording;
window.playTutorFeedback = playTutorFeedback;
window.playPronunciationFeedback = playPronunciationFeedback;
window.startSpeechRecognition = startSpeechRecognition;
window.pausePronunciationFeedback = pausePronunciationFeedback;
window.pauseTutorFeedback = pauseTutorFeedback;
window.playWordPronunciation = playWordPronunciation;
window.makeItSimpler = makeItSimpler;