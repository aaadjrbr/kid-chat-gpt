import { db } from "./firebaseConfig.js";
import { auth } from "./firebaseConfig.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
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
    alert("You need to be authenticated to perform this action.");
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

  // Add default "Select a kid" option
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Select a kid';
  defaultOption.selected = true;
  defaultOption.disabled = true;
  kidSelect.appendChild(defaultOption);

  const defaultEditOption = document.createElement('option');
  defaultEditOption.value = '';
  defaultEditOption.textContent = 'Select a kid';
  defaultEditOption.selected = true;
  defaultEditOption.disabled = true;
  editKidSelect.appendChild(defaultEditOption);

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
  });
}

// Add a kid
document.getElementById("add-kid-btn").addEventListener("click", async () => {
  ensureAuthenticated();
  const name = addKidNameInput.value;
  const balance = parseFloat(addKidBalanceInput.value);
  if (name && !isNaN(balance)) {
    await addDoc(bankRef, { name, balance, history: [] });
    alert(`Added ${name} with a balance of $${balance}`);
    fetchKids();
    addKidNameInput.value = '';
    addKidBalanceInput.value = '';
  } else {
    alert('Please enter a valid name and balance.');
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
    const kidDoc = doc(db, `bank/${auth.currentUser.uid}/kids/${selectedKid}`);
    const kidSnapshot = await getDoc(kidDoc);
    const kidData = kidSnapshot.exists() ? kidSnapshot.data() : {}; // Ensure kidData exists
    const priorBalance = kidData.balance ?? 0; // Default to 0 if balance is missing

    // Calculate the change
    const change = newBalance - priorBalance;
    const type = change > 0 ? "add" : "deduct";

    // Get current date details
    const now = new Date();
    const year = now.getFullYear().toString(); // Convert year to string for object key
    const month = (now.getMonth() + 1).toString(); // Convert month to string

    // Safely initialize `history` as an object
    let history = kidData.history;
    if (!history || typeof history !== "object" || Array.isArray(history)) {
      history = {}; // Force history to be an object
    }

    // Initialize year and month if not present
    if (!history[year]) history[year] = {};
    if (!history[year][month]) history[year][month] = [];

    // Add new transaction
    history[year][month].push({
      timestamp: now.toISOString(),
      change,
      type,
      priorBalance,
    });

    // Log the update object for debugging
    console.log("Update Object:", {
      balance: newBalance,
      history: history,
    });

    // Update Firestore
    await updateDoc(kidDoc, {
      balance: newBalance, // Ensure balance is valid
      history: history, // Ensure history is properly structured
    });

    alert(`Balance updated successfully!`);
    fetchKids();
    newBalanceInput.value = '';
  } else {
    alert('Please select a kid and enter a valid balance.');
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

          const listItem = document.createElement("li");
          listItem.textContent = `${formattedDate} ${formattedTime}: ${
            entry.type === "add" ? "+" : "-"
          }$${entry.change} (Prior: $${entry.priorBalance})`;
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
    bankRef = collection(db, `bank/${user.uid}/kids`);
    populateDateFilters(); // Ensure filters are populated after login
    fetchKids(); // Fetch kids for the authenticated user
  } else {
    console.log("User signed out.");
    bankRef = null;
  }
});