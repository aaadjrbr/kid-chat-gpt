import { db, auth } from "./firebaseConfig.js";
import { collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

// Firestore reference
let bankRef; // Reference to /bank/{parentId}/kids, assigned dynamically

// DOM Elements
const kidSelect = document.getElementById("kid-select");
const balanceAmount = document.getElementById("balance-amount");
const historyList = document.getElementById("history-list");
const filterMonth = document.getElementById("filter-month");
const filterYear = document.getElementById("filter-year");

// Populate month and year dropdowns
function populateDateFilters() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  for (let year = currentYear; year >= currentYear - 10; year--) {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    filterYear.appendChild(option);
    if (year === currentYear) {
      option.selected = true;
    }
  }

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  months.forEach((month, index) => {
    const option = document.createElement("option");
    option.value = index + 1;
    option.textContent = month;
    filterMonth.appendChild(option);
    if (index + 1 === currentMonth) {
      option.selected = true;
    }
  });
}

// Fetch all kids and populate dropdown
async function fetchKids() {
  try {
    const snapshot = await getDocs(bankRef);
    kidSelect.innerHTML = '<option value="">Select a kid</option>';
    snapshot.forEach((doc) => {
      const kid = doc.data();
      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = kid.name;
      kidSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error fetching kids:", error);
    alert("Failed to fetch kids. Please try again.");
  }
}

// Fetch and display balance and history for the selected kid
async function fetchKidData(kidId) {
  try {
    const kidDoc = await getDoc(doc(bankRef, kidId));
    if (kidDoc.exists()) {
      const kidData = kidDoc.data();
      balanceAmount.textContent = `$${kidData.balance}`;
      displayFilteredHistory(kidData.history || {});
    } else {
      alert("Kid data not found!");
    }
  } catch (error) {
    console.error("Error fetching kid data:", error);
  }
}

// Filter and display history by month and year
function displayFilteredHistory(history) {
  const selectedMonth = filterMonth.value;
  const selectedYear = filterYear.value;

  historyList.innerHTML = "";
  const monthlyHistory = history[selectedYear]?.[selectedMonth] || [];

  if (monthlyHistory.length === 0) {
    historyList.innerHTML = "<li>No history for the selected period.</li>";
  } else {
    // Sort by timestamp (most recent first)
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
}

// Event listener for selecting a kid
kidSelect.addEventListener("change", () => {
  const selectedKidId = kidSelect.value;
  if (selectedKidId) {
    fetchKidData(selectedKidId);
  }
});

// Event listener for filtering history
filterMonth.addEventListener("change", () => {
  const selectedKidId = kidSelect.value;
  if (selectedKidId) {
    fetchKidData(selectedKidId);
  }
});
filterYear.addEventListener("change", () => {
  const selectedKidId = kidSelect.value;
  if (selectedKidId) {
    fetchKidData(selectedKidId);
  }
});

// Initialize App After Authentication
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Set Firestore reference dynamically
    const parentId = user.uid; // Use the authenticated user's UID as parentId
    bankRef = collection(db, `bank/${parentId}/kids`);

    // Initialize dashboard
    populateDateFilters();
    fetchKids();
  } else {
    alert("User is not logged in.");
  }
});
