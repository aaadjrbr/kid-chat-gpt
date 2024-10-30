import { functions } from '../../scripts/firebase-config.js';
import { httpsCallable } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-functions.js";

let mediaRecorder;
let audioChunks = [];
let tutorFeedbackAudioUrl = '';
let pronunciationFeedbackAudioUrl = '';
let isPlaying = false; // Flag to check if audio is playing

// Function to call the English Tutor for syllable breakdown and pronunciation
async function callEnglishTutor() {
    const wordInput = document.getElementById("word-input").value;
    const englishOutput = document.getElementById("english-output");
    const playTutorFeedbackButton = document.getElementById("play-tutor-feedback");
    
    englishOutput.textContent = "⏳ Loading...";
    playTutorFeedbackButton.classList.add("hidden");

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
    }
}

let recognition;
if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = function(event) {
        document.getElementById("word-input").value = event.results[0][0].transcript;
    };

    recognition.onerror = function(event) {
        console.error("Speech recognition error:", event.error);
    };

    recognition.onend = function() {
        console.log("Speech recognition ended");
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

// Function to play the English Tutor feedback audio with flag check
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

// Function to start recording
function startRecording() {
    const wordInput = document.getElementById("word-input").value;
    const listeningMessage = document.getElementById("listening-message");

    if (!wordInput) {
        document.getElementById("english-output").textContent = "Please enter a word to analyze before recording.";
        return;
    }

    audioChunks = [];
    listeningMessage.style.display = "inline";
    document.getElementById("record-button").disabled = true;
    document.getElementById("stop-button").disabled = false;

    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.start();

            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };
        })
        .catch(error => {
            console.error("Error accessing microphone:", error);
            alert("Microphone access is required for recording.");
            resetButtons();
        });
}

// Function to stop recording and send audio to Whisper
function stopRecording() {
    mediaRecorder.stop();
    resetButtons();

    mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
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
        } catch (error) {
            console.error("Error transcribing audio:", error);
            document.getElementById("english-output").textContent = "Error: Could not transcribe audio.";
        }
    };
}

// Helper function to reset button states and hide "Listening…" message
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

// Make the functions accessible globally
window.callEnglishTutor = callEnglishTutor;
window.startRecording = startRecording;
window.stopRecording = stopRecording;
window.playTutorFeedback = playTutorFeedback;
window.playPronunciationFeedback = playPronunciationFeedback;
window.startSpeechRecognition = startSpeechRecognition;
