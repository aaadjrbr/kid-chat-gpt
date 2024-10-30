import { functions } from '../../scripts/firebase-config.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-functions.js";

let mediaRecorder;
let audioChunks = [];
let tutorFeedbackAudioUrl = '';
let pronunciationFeedbackAudioUrl = '';
let isPlaying = false; // Flag to check if audio is playing
let isProcessing = false; // Flag to check if processing is in progress

// Function to call the English Tutor for syllable breakdown and pronunciation
async function callEnglishTutor() {
    const wordInput = document.getElementById("word-input").value;
    const englishOutput = document.getElementById("english-output");
    const playTutorFeedbackButton = document.getElementById("play-tutor-feedback");
    const playPronunciationFeedbackButton = document.getElementById("play-pronunciation-feedback");

    // Reset the output and button visibility
    englishOutput.textContent = "⏳ Loading...";
    playTutorFeedbackButton.classList.add("hidden");
    playPronunciationFeedbackButton.classList.add("hidden");
    pronunciationFeedbackAudioUrl = ''; // Clear any previous pronunciation audio
    isProcessing = true; // Indicate processing

    const getEnglishTutorResponse = httpsCallable(functions, 'getEnglishTutorResponse');
    try {
        const response = await getEnglishTutorResponse({ wordPrompt: wordInput });
        
        englishOutput.textContent = response.data.message;
        const generateSpeechFunction = response.data.isGrammarFeedback 
            ? httpsCallable(functions, 'generateSlowSpeech') 
            : httpsCallable(functions, 'generatePronunciationFeedback');

        const audioResponse = await generateSpeechFunction({ text: response.data.plainTextSyllables });
        tutorFeedbackAudioUrl = audioResponse.data;

        playTutorFeedbackButton.classList.remove("hidden");
    } catch (error) {
        console.error("Error calling English Tutor:", error);
        englishOutput.textContent = "Error: Could not fetch syllable breakdown.";
    } finally {
        isProcessing = false; // End processing state
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
    if (isProcessing) return; // Prevent actions if processing

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

// Function to stop recording and send audio to Whisper with feedback messages
function stopRecording() {
    if (!mediaRecorder) return; // If no recording in progress, exit

    mediaRecorder.stop();
    resetButtons();
    document.getElementById("english-output").textContent = "🎤 Checking speech...";
    isProcessing = true; // Set processing flag

    mediaRecorder.onstop = async () => {
        let audioBlob;
        
        // Check MIME type compatibility based on available chunks
        if (audioChunks.length > 0 && audioChunks[0].type === "audio/webm") {
            audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        } else {
            // Fallback to a general audio format if `audio/webm` is unavailable
            audioBlob = new Blob(audioChunks, { type: "audio/mp4" });
        }

        const audioBase64 = await convertBlobToBase64(audioBlob);
        const wordInput = document.getElementById("word-input").value;
        const whisperTranscription = httpsCallable(functions, 'generatePronunciationPractice');

        try {
            const response = await whisperTranscription({ word: wordInput, userAudioBase64: audioBase64 });
            document.getElementById("english-output").textContent = response.data.feedback;

            const generatePronunciationFeedback = httpsCallable(functions, 'generatePronunciationFeedback');
            const pronunciationAudioResponse = await generatePronunciationFeedback({ text: wordInput });
            pronunciationFeedbackAudioUrl = pronunciationAudioResponse.data;

            document.getElementById("play-pronunciation-feedback").classList.remove("hidden");
            document.getElementById("play-tutor-feedback").classList.add("hidden");
        } catch (error) {
            console.error("Error transcribing audio:", error);
            document.getElementById("english-output").textContent = "Error: Could not transcribe audio.";
        } finally {
            isProcessing = false; // End processing state
        }
    };
}

function startSpeechRecognition() {
    const wordInput = document.getElementById("word-input");

    if (recognition) {
        recognition.start();
        wordInput.classList.add("recording");

        recognition.onend = function() {
            wordInput.classList.remove("recording");
            console.log("Speech recognition ended");
        };
    } else {
        alert("Speech recognition is not supported in this browser.");
    }
}

// Function to play the English Tutor feedback audio with a flag to prevent overlapping playback
function playTutorFeedback() {
    if (tutorFeedbackAudioUrl && !isPlaying) {
        isPlaying = true; // Set flag to indicate audio is playing
        const audio = new Audio(tutorFeedbackAudioUrl);
        audio.play();
        audio.onended = () => { isPlaying = false; }; // Reset flag when audio ends
    } else if (isPlaying) {
        console.log("Audio is already playing.");
    } else {
        console.error("No tutor feedback audio available.");
    }
}

// Function to play the pronunciation feedback audio with flag check
function playPronunciationFeedback() {
    if (pronunciationFeedbackAudioUrl && !isPlaying) {
        isPlaying = true;
        const audio = new Audio(pronunciationFeedbackAudioUrl);
        audio.play();
        audio.onended = () => { isPlaying = false; };
    } else if (isPlaying) {
        console.log("Audio is already playing.");
    } else {
        console.error("No pronunciation feedback audio available.");
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

// Make functions accessible globally
window.callEnglishTutor = callEnglishTutor;
window.startRecording = startRecording;
window.stopRecording = stopRecording;
window.playTutorFeedback = playTutorFeedback;
window.playPronunciationFeedback = playPronunciationFeedback;
window.startSpeechRecognition = startSpeechRecognition;
