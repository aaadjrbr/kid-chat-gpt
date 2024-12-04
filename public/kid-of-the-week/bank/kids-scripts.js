import { db } from "./firebaseConfig.js";
import { collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// Firestore reference
const bankRef = collection(db, "bank");

// DOM Elements
const kidSelect = document.getElementById("kid-select");
const balanceAmount = document.getElementById("balance-amount");
const historyList = document.getElementById("history-list");
const filterMonth = document.getElementById("filter-month");
const filterYear = document.getElementById("filter-year");

// Populate month and year dropdowns
function populateDateFilters() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // Month is zero-indexed

  // Populate years (last 10 years including current year)
  for (let year = currentYear; year >= currentYear - 10; year--) {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    filterYear.appendChild(option);

    // Set the current year as the default selection
    if (year === currentYear) {
      option.selected = true;
    }
  }

  // Populate months (1–12)
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  months.forEach((month, index) => {
    const option = document.createElement("option");
    option.value = index + 1; // Month value (1-12)
    option.textContent = month;
    filterMonth.appendChild(option);

    // Set the current month as the default selection
    if (index + 1 === currentMonth) {
      option.selected = true;
    }
  });
}

// Fetch all kids and populate dropdown
async function fetchKids() {
  const snapshot = await getDocs(bankRef);
  snapshot.forEach((doc) => {
    const kid = doc.data();
    const option = document.createElement("option");
    option.value = doc.id;
    option.textContent = kid.name;
    kidSelect.appendChild(option);
  });
}

// Fetch and display balance and history for the selected kid
async function fetchKidData(kidId) {
  const kidDoc = await getDoc(doc(bankRef, kidId));
  if (kidDoc.exists()) {
    const kidData = kidDoc.data();
    // Display balance
    balanceAmount.textContent = `$${kidData.balance}`;
    // Display filtered history
    displayFilteredHistory(kidData.history || {}); // Pass empty object if history is undefined
  } else {
    alert("Kid data not found!");
  }
}

// Filter and display history by month and year
function displayFilteredHistory(history) {
  const selectedMonth = filterMonth.value; // Get selected month as a string
  const selectedYear = filterYear.value; // Get selected year as a string

  historyList.innerHTML = ""; // Clear current history list

  // Safely access the selected year's and month's history
  const monthlyHistory = history[selectedYear]?.[selectedMonth] || [];

  // Display filtered history
  if (monthlyHistory.length === 0) {
    historyList.innerHTML = "<li>No history for the selected period.</li>";
  } else {
    monthlyHistory.forEach((entry) => {
      const entryDate = new Date(entry.timestamp); // Convert timestamp to Date object
      const formattedDate = entryDate.toLocaleDateString(); // Format the date
      const formattedTime = entryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // Format the time

      const listItem = document.createElement("li");
      listItem.textContent = `${formattedDate} ${formattedTime}: ${
        entry.type === "add" ? "+" : "-"
      }$${entry.change} (Prior: $${entry.priorBalance})`;

      // Prepend instead of append to invert the order
      historyList.prepend(listItem);
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

// Initialize
populateDateFilters();
fetchKids();
