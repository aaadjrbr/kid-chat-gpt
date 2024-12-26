// Import Firebase and necessary functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-functions.js";
import { getFirestore, doc, getDoc, updateDoc, setDoc, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
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
        let updateNeeded = false;  // Track if we need to update the profile

        // Check and set defaults for each field if missing
        if (userData.tokens === undefined) {
            userTokens = TOKEN_LIMITS.free; // Default to 5 tokens for free users
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

        // Handle token depletion and refill if necessary
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
let isProcessingDeduction = false; // Prevent simultaneous deductions

async function deductToken() {
    if (isProcessingDeduction) {
        console.warn("Token deduction is already in progress.");
        return;
    }

    if (!parentId) {
        console.error("Parent ID is not available. Cannot deduct tokens.");
        return;
    }

    isProcessingDeduction = true; // Lock to prevent simultaneous calls
    const userProfileRef = doc(db, `userProfiles/${parentId}`);

    try {
        await runTransaction(db, async (transaction) => {
            const userProfileSnapshot = await transaction.get(userProfileRef);

            if (!userProfileSnapshot.exists()) {
                throw "User profile does not exist!";
            }

            const userData = userProfileSnapshot.data();
            const maxTokens = isPremium
                ? TOKEN_LIMITS.premium
                : isGold
                ? TOKEN_LIMITS.gold
                : TOKEN_LIMITS.free;

            // Validate current tokens
            if (userData.tokens > 0) {
                const updatedTokens = userData.tokens - 1;

                transaction.update(userProfileRef, {
                    tokens: updatedTokens,
                });

                console.log(`Token deducted. Remaining tokens: ${updatedTokens}`);
                userTokens = updatedTokens; // Update local state
                updateTokenBar(); // Update the UI
            } else {
                throw "Insufficient tokens!";
            }

            // Handle token depletion
            if (userData.tokens === 1) {
                if (!userData.tokensDepletedTimestamp) {
                    console.warn("Tokens depleted. Setting depletion timestamp.");
                    transaction.update(userProfileRef, {
                        tokensDepletedTimestamp: serverTimestamp(),
                    });
                }
                displayTokenRefillCountdown(60 * 60 * 1000); // Start a 1-hour countdown
            }
        });
    } catch (error) {
        console.error("Failed to deduct token:", error);
    } finally {
        isProcessingDeduction = false; // Unlock after completion
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
export async function getMathTutorExplanation(deductTokenFlag = true) {
    const mathPrompt = document.getElementById('mathPrompt').value;
    const outputContainer = document.getElementById('outputContainer');

    if (deductTokenFlag && userTokens <= 0) {
        outputContainer.innerHTML = "🌟 Oops! You're out of tokens! Wait for them to refill soon! 😊";
        return;
    }

    // Deduct token only if `deductTokenFlag` is true
    if (deductTokenFlag) {
        await deductToken();
    }

    outputContainer.innerHTML = "⏳ Loading explanation...";

    // Scroll to outputContainer
    outputContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Modify math prompt to handle square root symbol
    const processedPrompt = mathPrompt.replace(/√(\d+)/g, 'Math.sqrt($1)');

    // Send message to session memory
    sessionMessages.push({ role: "user", content: processedPrompt });

    try {
        const response = await getMathTutorResponse({
            mathPrompt: processedPrompt,
            messages: sessionMessages,
        });

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

function saveAsPDF() {
    // Clone the output container content without the "Save as PDF" button
    const outputContent = document.getElementById('outputContainer').cloneNode(true);

    // Remove the "Save as PDF" button if it exists in the cloned content
    const saveButton = outputContent.querySelector('.action-button.secondary');
    if (saveButton) {
        saveButton.remove();
    }

    // Add the header with a logo
    const header = document.createElement('div');
    header.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <img src="../../images/alfie-header.jpeg" style="width: 120px; height: auto;" crossorigin="anonymous">
        </div>
    `;

    // Prepend the header to the cloned output content
    outputContent.insertBefore(header, outputContent.firstChild);

    // Add the footer with the logo, disclaimer text, website link, and page numbering placeholder
    const footer = document.createElement('div');
    footer.innerHTML = `
        <div style="text-align: center; margin-top: 20px;">
            <img src="../../images/alfie-footer.jpeg" style="width: 120px; height: auto;" crossorigin="anonymous">
            <p style="color: #696767; font-size: 0.8em; margin-top: 8px;">
                This math explanation was generated using AI through Alfie AI Kids. It's important to remember that Alfie AI can make mistakes. Please check important information with your teacher.
            </p>
            <p style="color: #696767; font-size: 0.8em;">
                <a href="https://alfieaikids.fun/" target="_blank" style="color: #696767; text-decoration: none;">https://alfieaikids.fun/</a>
            </p>
        </div>
    `;

    // Append the footer to the cloned output content
    outputContent.appendChild(footer);

    // Configure html2pdf options
    const options = {
        margin: 1,
        filename: 'Alfie_Math_Explanation.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] } // Ensure page breaks work properly
    };

    // Generate and save the PDF with page numbers
    setTimeout(() => {
        html2pdf().from(outputContent).set(options).toPdf().get('pdf').then((pdf) => {
            const totalPages = pdf.internal.getNumberOfPages();
            
            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i);
                pdf.setFontSize(10);
                pdf.text(`Page ${i} of ${totalPages}`, pdf.internal.pageSize.width - 50, pdf.internal.pageSize.height - 10); // Adjusted positioning
            }
            
            // Save the PDF after adding page numbers
            pdf.save('AlfieAIKids_MathTutor_Explanation.pdf');
        });
    }, 500); // 500ms delay to allow images to load
}

// Display explanation with formatting for MathJax rendering
function displayExplanation(explanation) {
    const outputContainer = document.getElementById('outputContainer');
    outputContainer.innerHTML = ""; // Clear previous content

    const lines = explanation.split('\n');
    let currentList = null; // Track the current list element
    let currentIndent = 0; // Track the indentation level for nested lists
    let isStepItem = false; // Track if the current list item is a step

    lines.forEach((line) => {
        // Skip empty lines
        if (line.trim() === "") return;

        // Handle headings (e.g., ### Step 1)
        if (line.startsWith("### ")) {
            const heading = document.createElement('div');
            heading.className = "step-header";
            heading.textContent = line.replace("### ", "");
            outputContainer.appendChild(heading);
        }
        // Handle separators (e.g., ---)
        else if (line.trim() === "---") {
            const separator = document.createElement('hr');
            separator.className = "explanation-separator";
            outputContainer.appendChild(separator);
        }
        // Handle bullet points or lists (e.g., - item or indented items)
        else if (line.startsWith("- ") || line.match(/^\s*-\s/) || line.match(/^\d+\.\s/)) {
            const indentLevel = line.match(/^\s*/)[0].length; // Calculate indentation level
            const listItemText = line.replace(/^\s*-\s|^\d+\.\s/, "").trim(); // Remove bullet/number

            // Create a new list if indentation level changes or no list exists
            if (!currentList || indentLevel !== currentIndent) {
                currentList = document.createElement('ul');
                currentList.className = isStepItem ? "explanation-list-steps" : "explanation-list";
                outputContainer.appendChild(currentList);
                currentIndent = indentLevel;
            }

            // Create list item
            const listItem = document.createElement('li');

            // Check if the list item is a step (contains ** or has specific formatting)
            if (line.includes("**")) {
                listItem.className = "step-item"; // Add a class for steps
                isStepItem = true; // This is a step
            } else {
                isStepItem = false; // This is a regular list item
            }

            listItem.innerHTML = listItemText
                .replace(/\*\*(.*?)\*\*/g, '<strong class="emphasis">$1</strong>') // Bold with emphasis
                .replace(/\*(.*?)\*/g, '<em>$1</em>'); // Italics
            currentList.appendChild(listItem);
        }
        // Handle code blocks (e.g., ```code```)
        else if (line.startsWith("```") && line.endsWith("```")) {
            const codeBlock = document.createElement('pre');
            codeBlock.className = "explanation-code";
            codeBlock.textContent = line.slice(3, -3).trim();
            outputContainer.appendChild(codeBlock);
        }
        // Handle final answer or conclusion
        else if (line.startsWith("Final Answer:")) {
            const finalAnswer = document.createElement('div');
            finalAnswer.className = "step final-answer";
            finalAnswer.innerHTML = line
                .replace(/\*\*(.*?)\*\*/g, '<strong class="emphasis">$1</strong>'); // Bold with emphasis
            outputContainer.appendChild(finalAnswer);
        }
        // Default text (steps)
        else {
            // If there's an active list, close it
            if (currentList) {
                currentList = null;
                currentIndent = 0;
                isStepItem = false; // Reset step item flag
            }
            const step = document.createElement('div');
            step.className = "step";
            step.innerHTML = line
                .replace(/\*\*(.*?)\*\*/g, '<strong class="emphasis">$1</strong>') // Bold with emphasis
                .replace(/\*(.*?)\*/g, '<em>$1</em>'); // Italics
            outputContainer.appendChild(step);
        }
    });

    // Re-add the "Save as PDF" button
    const saveButton = document.createElement('button');
    saveButton.className = 'action-button secondary';
    saveButton.textContent = 'Save as PDF 📄';
    saveButton.onclick = saveAsPDF;
    outputContainer.appendChild(saveButton);

    // Render MathJax for math expressions
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

    // Deduct token for the "make it simpler" request
    await deductToken();

    // Add a simpler explanation request to session messages
    sessionMessages.push({
        role: "user",
        content: "Could you explain it more simply in steps? Yet keeping the steps of how to achieve the result without simply telling me the answer. The 'why' and 'how' I get to the result is important."
    });

    // Call the tutor explanation logic but without deducting a token
    await getMathTutorExplanation(false);
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
window.saveAsPDF = saveAsPDF;