import { db } from "./firebaseConfig.js";
import { auth } from "./firebaseConfig.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  runTransaction, // Import runTransaction
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

// Firestore references
let bankRef; // Use let to allow reassignment

// DOM Elements
const balancesList = document.getElementById("balances-list");
const kidSelect = document.getElementById("kid-select");
const editKidSelect = document.getElementById("edit-kid-select");
const newBalanceInput = document.getElementById("new-balance");
const addKidNameInput = document.getElementById("add-kid-name");
const addKidBalanceInput = document.getElementById("add-kid-balance");
const newKidNameInput = document.getElementById("new-kid-name");
const historyList = document.getElementById("history-list");

// Authentication Check
function ensureAuthenticated() {
  if (!auth.currentUser) {
    console.log("You need to be authenticated to perform this action.");
    throw new Error("User not authenticated.");
  }
}

// Fetch kids and update UI
async function fetchKids() {
  ensureAuthenticated();
  const snapshot = await getDocs(bankRef); // bankRef includes user's `uid`
  const kids = [];
  snapshot.forEach((doc) => {
    kids.push({ id: doc.id, ...doc.data() });
  });
  updateKidsUI(kids);
}

// Update kids UI
function updateKidsUI(kids) {
  balancesList.innerHTML = '';
  kidSelect.innerHTML = '';
  editKidSelect.innerHTML = '';
  
  // Ensure kid-select-adjust exists
  const adjustKidSelect = document.getElementById('kid-select-adjust');
  if (adjustKidSelect) adjustKidSelect.innerHTML = '';

  // Add default "Select a kid" option for each dropdown
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Select a kid';
  defaultOption.selected = true;
  defaultOption.disabled = true;

  const defaultEditOption = defaultOption.cloneNode(true);
  const defaultAdjustOption = defaultOption.cloneNode(true);

  kidSelect.appendChild(defaultOption);
  editKidSelect.appendChild(defaultEditOption);
  if (adjustKidSelect) adjustKidSelect.appendChild(defaultAdjustOption);

  // Populate dropdowns and balances list
  kids.forEach((kid) => {
    // Balance List
    const balanceItem = document.createElement('div');
    balanceItem.textContent = `${kid.name}: $${kid.balance}`;
    balancesList.appendChild(balanceItem);

    // Kid Select Options
    const option1 = document.createElement('option');
    option1.value = kid.id;
    option1.textContent = kid.name;
    kidSelect.appendChild(option1);

    const option2 = document.createElement('option');
    option2.value = kid.id;
    option2.textContent = kid.name;
    editKidSelect.appendChild(option2);

    // Add to adjust balance dropdown if it exists
    if (adjustKidSelect) {
      const option3 = document.createElement('option');
      option3.value = kid.id;
      option3.textContent = kid.name;
      adjustKidSelect.appendChild(option3);
    }
  });

  console.log("Dropdowns updated with kids:", kids);
}

// Add a kid
document.getElementById("add-kid-btn").addEventListener("click", async () => {
  ensureAuthenticated();
  const name = addKidNameInput.value.trim(); // Ensure no trailing spaces

  if (name) {
    try {
      // Add kid with a default balance of 0
      await addDoc(bankRef, {
        name,
        balance: 0, // Default balance
        history: {}, // Default empty history
      });
      alert(`Added ${name} with a balance of $0`);
      fetchKids(); // Refresh the list of kids
      addKidNameInput.value = ''; // Clear input field
    } catch (error) {
      console.error("Error adding kid:", error);
      alert("Failed to add the kid. Please try again.");
    }
  } else {
    alert("Please enter a valid name.");
  }
});

// Rename a kid
document.getElementById("rename-kid-btn").addEventListener("click", async () => {
  ensureAuthenticated();
  const selectedKid = editKidSelect.value;
  const newName = newKidNameInput.value;
  if (selectedKid && newName) {
    const kidDoc = doc(db, `bank/${auth.currentUser.uid}/kids/${selectedKid}`);
    await updateDoc(kidDoc, { name: newName });    
    alert(`Renamed kid to ${newName}`);
    fetchKids();
    newKidNameInput.value = '';
  } else {
    alert('Please select a kid and enter a new name.');
  }
});

// Remove a kid
document.getElementById("remove-kid-btn").addEventListener("click", async () => {
  ensureAuthenticated();
  const selectedKid = editKidSelect.value;
  if (selectedKid) {
    const confirmDelete = confirm("Are you sure you want to remove this kid? This action cannot be undone.");
    if (confirmDelete) {
      const kidDoc = doc(db, `bank/${auth.currentUser.uid}/kids/${selectedKid}`);
      await deleteDoc(kidDoc);
      try {
        await deleteDoc(kidDoc);
        alert("Kid removed successfully.");
        fetchKids();
      } catch (error) {
        console.error("Error removing kid:", error);
        alert("Failed to remove the kid. Please try again.");
      }
    }
  } else {
    alert("Please select a kid to remove.");
  }
});

// Set balance for a kid
document.getElementById("set-balance-btn").addEventListener("click", async () => {
  ensureAuthenticated();
  const selectedKid = kidSelect.value;
  const newBalance = parseFloat(newBalanceInput.value);

  if (selectedKid && !isNaN(newBalance)) {
    const kidDocRef = doc(db, `bank/${auth.currentUser.uid}/kids/${selectedKid}`);

    try {
      await runTransaction(db, async (transaction) => {
        const kidDoc = await transaction.get(kidDocRef);
        if (!kidDoc.exists()) {
          throw new Error("Kid document does not exist.");
        }

        const kidData = kidDoc.data();
        const priorBalance = kidData.balance || 0; // Ensure priorBalance is valid
        const change = newBalance - priorBalance;
        const type = change > 0 ? "deposit" : "withdrawal"; // Use "deposit" instead of "add"

        // Get current date
        const now = new Date();
        const year = now.getFullYear().toString();
        const month = (now.getMonth() + 1).toString();

        // Ensure history is properly initialized
        const history = kidData.history || {};
        if (!history[year]) history[year] = {};
        if (!history[year][month]) history[year][month] = [];

        // Add new transaction
        history[year][month].push({
          timestamp: now.toISOString(),
          change,
          type, // Use "deposit" or "withdrawal"
          priorBalance,
        });

        // Update kid's balance and history
        transaction.update(kidDocRef, {
          balance: newBalance,
          history: history,
        });
      });

      alert("Balance updated successfully!");
      fetchKids();
      newBalanceInput.value = '';
    } catch (error) {
      console.error("Error updating balance:", error);
      alert("Failed to update the balance. Please try again.");
    }
  } else {
    alert("Please select a kid and enter a valid balance.");
  }
});

document.getElementById("adjust-balance-btn").addEventListener("click", async () => {
  ensureAuthenticated();
  const selectedKid = document.getElementById("kid-select-adjust").value;
  const adjustmentType = document.getElementById("adjustment-type").value; // Deposit or Withdrawal
  const adjustmentAmount = parseFloat(document.getElementById("adjustment-amount").value);

  if (selectedKid && !isNaN(adjustmentAmount) && adjustmentAmount > 0) {
    const kidDocRef = doc(db, `bank/${auth.currentUser.uid}/kids/${selectedKid}`);

    try {
      let success = false; // Track if the transaction was successful
      await runTransaction(db, async (transaction) => {
        const kidDoc = await transaction.get(kidDocRef);
        if (!kidDoc.exists()) {
          throw new Error("Kid document does not exist.");
        }

        const kidData = kidDoc.data();
        const priorBalance = kidData.balance || 0;

        // Determine the change based on the adjustment type
        const change = adjustmentType === "deposit" ? adjustmentAmount : -adjustmentAmount; // Add or Deduct
        const newBalance = priorBalance + change;

        // Ensure the balance does not go below zero for withdrawals
        if (newBalance < 0) {
          alert("Insufficient funds!");
          return; // Stop the transaction
        }

        // If we reach here, proceed with the transaction
        const now = new Date();
        const year = now.getFullYear().toString();
        const month = (now.getMonth() + 1).toString();

        // Initialize history object
        const history = kidData.history || {};
        if (!history[year]) history[year] = {};
        if (!history[year][month]) history[year][month] = [];

        // Add new transaction
        history[year][month].push({
          timestamp: now.toISOString(),
          change,
          type: adjustmentType, // Deposit or Withdrawal
          priorBalance,
        });

        // Update kid's balance and history
        transaction.update(kidDocRef, {
          balance: newBalance,
          history: history,
        });

        success = true; // Mark the transaction as successful
      });

      if (success) {
        alert("Balance adjusted successfully!");
        fetchKids();
        document.getElementById("adjustment-amount").value = '';
      }
    } catch (error) {
      console.error("Error adjusting balance:", error);
      alert("Failed to adjust balance. Please try again.");
    }
  } else {
    alert("Please select a kid, choose an action, and enter a valid amount.");
  }
});

// Populate month and year dropdowns
function populateDateFilters() {
  const yearDropdown = document.getElementById("filter-year");
  const monthDropdown = document.getElementById("filter-month");

  if (!yearDropdown || !monthDropdown) {
    console.error("Year or month dropdown not found in DOM.");
    return;
  }

  // Clear existing options
  yearDropdown.innerHTML = "";
  monthDropdown.innerHTML = "";

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Populate years
  for (let year = currentYear; year >= currentYear - 10; year--) {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearDropdown.appendChild(option);

    if (year === currentYear) {
      option.selected = true;
    }
  }

  // Populate months
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  months.forEach((month, index) => {
    const option = document.createElement("option");
    option.value = index + 1; // Month value (1-12)
    option.textContent = month;
    monthDropdown.appendChild(option);

    if (index + 1 === currentMonth) {
      option.selected = true;
    }
  });
}

// Event listener for selecting a kid or updating filters
document.getElementById("kid-select").addEventListener("change", fetchAndDisplayHistory);
document.getElementById("filter-year").addEventListener("change", fetchAndDisplayHistory);
document.getElementById("filter-month").addEventListener("change", fetchAndDisplayHistory);

// Fetch and display transactions based on filters
async function fetchAndDisplayHistory() {
  const selectedKid = kidSelect.value;
  const selectedYear = document.getElementById("filter-year").value;
  const selectedMonth = document.getElementById("filter-month").value;

  if (!selectedKid) {
    alert("Please select a kid to view their transaction history.");
    return;
  }

  try {
    // Fetch kid's document
    const kidDoc = doc(db, `bank/${auth.currentUser.uid}/kids/${selectedKid}`);
    const kidSnapshot = await getDoc(kidDoc);

    if (kidSnapshot.exists()) {
      const kidData = kidSnapshot.data();
      const history = kidData.history || {};
      const monthlyHistory = history[selectedYear]?.[selectedMonth] || [];

      // Display transactions
      historyList.innerHTML = '';
      if (monthlyHistory.length === 0) {
        historyList.innerHTML = "<li>No transactions for this month.</li>";
      } else {
        // Sort transactions by timestamp (most recent first)
        const sortedHistory = [...monthlyHistory].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        sortedHistory.forEach((entry) => {
          const entryDate = new Date(entry.timestamp);
          const formattedDate = entryDate.toLocaleDateString();
          const formattedTime = entryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          // Calculate the total balance after the transaction
          const totalBalance = entry.priorBalance + entry.change;

          // Create list item
          const listItem = document.createElement("li");
          listItem.textContent = `${formattedDate} ${formattedTime}: ${
            entry.type === "deposit" ? "Deposited 💰" : "Withdrew 💸"
          } $${Math.abs(entry.change)} (Prior: $${entry.priorBalance}) - Total: $${totalBalance}`;

          // Add a class based on transaction type
          listItem.classList.add(entry.type === "deposit" ? "deposit" : "withdraw");

          historyList.appendChild(listItem);
        });
      }
    } else {
      console.error("Kid document not found.");
      alert("No data found for the selected kid.");
    }
  } catch (error) {
    console.error("Error fetching history:", error);
    alert("Failed to fetch transaction history. Please try again.");
  }
}

// Function to show the modal
function showModal() {
  const modal = document.getElementById("name-modal");
  modal.style.display = "block";
}

// Function to show the modal with a message
function showModalWithMessage(message, isError = true) {
  const modalMessage = document.getElementById("modal-message");
  const closeModalBtn = document.getElementById("close-modal-btn");
  const saveNameBtn = document.getElementById("save-name-btn"); // Get the "Save" button
  const parentNameInput = document.getElementById("parent-name-input"); // Get the input field
  const modalTitle = document.getElementById("modal-title"); // Get the <h2> element

  modalMessage.textContent = message;
  modalMessage.style.color = isError ? "red" : "green";
  modalMessage.style.display = "block";

  // Show the "Close" button only if the message is "Name saved successfully!"
  if (message === "Name saved successfully!") {
    closeModalBtn.style.display = "block"; // Show the "Close" button
    saveNameBtn.style.display = "none"; // Hide the "Save" button
    parentNameInput.style.display = "none"; // Hide the input field
    modalTitle.style.display = "none"; // Hide the <h2> element
  } else {
    closeModalBtn.style.display = "none"; // Hide the "Close" button
    saveNameBtn.style.display = "block"; // Show the "Save" button
    parentNameInput.style.display = "block"; // Show the input field
    modalTitle.style.display = "block"; // Show the <h2> element
  }

  showModal();
}

// Function to display the welcome message
function displayWelcomeMessage(parentName) {
  console.log("Displaying welcome message for:", parentName); // Debugging log
  const welcomeMessageDiv = document.getElementById("welcome-message");
  const parentNameDisplay = document.getElementById("parent-name-display");

  if (parentName) {
    parentNameDisplay.textContent = parentName; // Set the parent's name
    welcomeMessageDiv.style.display = "block"; // Show the welcome message
  } else {
    welcomeMessageDiv.style.display = "none"; // Hide the welcome message if no name
  }
}

// Function to check if the name field exists in the userProfiles collection
async function checkUserProfileName() {
  ensureAuthenticated();

  // Use the authenticated user's UID as the parentId
  const parentId = auth.currentUser.uid; // Replace with the actual parent ID
  const userProfileDocRef = doc(db, `userProfiles/${parentId}`);

  try {
    console.log("Fetching user profile document..."); // Debugging log
    const userProfileDoc = await getDoc(userProfileDocRef);

    if (!userProfileDoc.exists()) {
      console.log("User profile document does not exist."); // Debugging log
      showModal(); // Show the modal if the document doesn't exist
    } else {
      const parentName = userProfileDoc.data().name;
      console.log("Fetched parent name:", parentName); // Debugging log

      // Check if the `name` field is missing
      if (!parentName) {
        console.log("Name field is missing in the document."); // Debugging log
        showModal(); // Show the modal if the name field is missing
      } else {
        // If the name exists, display the welcome message
        displayWelcomeMessage(parentName);
      }
    }
  } catch (error) {
    console.error("Error checking user profile:", error);
    showModalWithMessage("Failed to check user profile. Please try again."); // Show error message in modal
  }
}

// Event listener for the "Save" button in the modal
document.getElementById("save-name-btn").addEventListener("click", async () => {
  const parentNameInput = document.getElementById("parent-name-input");
  const parentName = parentNameInput.value.trim();

  if (parentName) {
    console.log("Saving parent name:", parentName); // Debugging log

    // Use the authenticated user's UID as the parentId
    const parentId = auth.currentUser.uid; // Replace with the actual parent ID
    const userProfileDocRef = doc(db, `userProfiles/${parentId}`);

    try {
      // Update or create the document with the `name` field
      await setDoc(
        userProfileDocRef,
        { name: parentName },
        { merge: true } // Merge to avoid overwriting other fields
      );

      console.log("Name saved successfully!"); // Debugging log

      // Show success message inside the modal
      showModalWithMessage("Name saved successfully!", false);

      // Clear the input field
      parentNameInput.value = "";

      // Display the welcome message
      displayWelcomeMessage(parentName);
    } catch (error) {
      console.error("Error saving parent name:", error);
      showModalWithMessage("Failed to save parent name. Please try again.");
    }
  } else {
    console.log("Invalid parent name entered."); // Debugging log
    showModalWithMessage("Please enter a valid name.");
  }
});

// Event listener for the "Close" button in the modal
document.getElementById("close-modal-btn").addEventListener("click", () => {
  const modal = document.getElementById("name-modal");
  modal.style.display = "none"; // Hide the modal
});

// Call the check function when the page loads or when needed
checkUserProfileName();

// Sign In Example
document.getElementById("sign-in-btn")?.addEventListener("click", async () => {
  const email = prompt("Enter your email:");
  const password = prompt("Enter your password:");
  try {
    await signInWithEmailAndPassword(auth, email, password);
    alert("Signed in successfully!");
    fetchKids();
  } catch (error) {
    alert("Authentication failed: " + error.message);
  }
});

// Sign Out Example
document.getElementById("sign-out-btn")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    alert("Signed out successfully!");
  } catch (error) {
    alert("Sign out failed: " + error.message);
  }
});

// Initial Auth Check
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("User is authenticated:", user.uid); // Debugging log
    bankRef = collection(db, `bank/${user.uid}/kids`);
    populateDateFilters(); // Populate dropdowns for filtering
    fetchKids(); // Fetch kids and update the UI

    // Check the user profile name after authentication
    checkUserProfileName();
  } else {
    console.log("User signed out.");
    bankRef = null;
  }
});