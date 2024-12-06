import { db } from "./firebaseConfig.js";
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

const auth = getAuth();

const weeklyRankingDiv = document.getElementById("weeklyRanking");
const totalRankingDiv = document.getElementById("totalRanking");
const goalListDiv = document.getElementById("goalList");
const weekEndDisplay = document.getElementById("weekEndDisplay");
const refreshButton = document.getElementById("refreshButton");

function initApp() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log(`Logged in as: ${user.email}`);
      // Initialize data fetching
      fetchRankings();
      fetchGoals();
      fetchWeekEnd();
    } else {
      console.log("User not logged in. Redirecting to login page...");
      window.location.href = "../login.html"; // Replace with your login page
    }
  });
}

// Fetch and display rankings with caching
async function fetchRankings(forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) {
    console.log("User not logged in.");
    return;
  }

  if (!forceRefresh) {
    const cachedRankings = sessionStorage.getItem("rankings");
    if (cachedRankings) {
      console.log("Using cached rankings.");
      const { weeklyRankings, totalRankings } = JSON.parse(cachedRankings);
      renderRankings(weeklyRankings, totalRankings);
      return;
    }
  }

  console.log("Fetching rankings from Firestore.");
  try {
    const kidsCollectionRef = collection(db, `Kids/${user.uid}/kids`);
    const kidsSnapshot = await getDocs(kidsCollectionRef);
    const kids = [];

    kidsSnapshot.forEach((doc) => {
      const data = doc.data();
      kids.push({ name: doc.id, ...data });
    });

    // Sort by weekly points
    const weeklyRankings = [...kids].sort((a, b) => b.weeklyPoints - a.weeklyPoints);

    // Sort by total points
    const totalRankings = [...kids].sort((a, b) => b.totalPoints - a.totalPoints);

    // Cache the data
    sessionStorage.setItem(
      "rankings",
      JSON.stringify({ weeklyRankings, totalRankings })
    );

    renderRankings(weeklyRankings, totalRankings);
  } catch (error) {
    console.error("Error fetching rankings:", error);
  }
}

// Fetch and display goals with caching
async function fetchGoals(forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) {
    console.log("User not logged in.");
    return;
  }

  if (!forceRefresh) {
    const cachedGoals = sessionStorage.getItem("goals");
    if (cachedGoals) {
      console.log("Using cached goals.");
      renderGoals(JSON.parse(cachedGoals));
      return;
    }
  }

  console.log("Fetching goals from Firestore.");
  try {
    const goalCollectionRef = collection(db, `Goals/${user.uid}/userGoals`);
    const goalSnapshot = await getDocs(goalCollectionRef);
    const goals = [];

    goalSnapshot.forEach((doc) => {
      goals.push({ id: doc.id, ...doc.data() });
    });

    // Cache the data
    sessionStorage.setItem("goals", JSON.stringify(goals));

    renderGoals(goals);
  } catch (error) {
    console.error("Error fetching goals:", error);
  }
}

// Fetch and display week end date with caching
async function fetchWeekEnd(forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) {
    console.log("User not logged in.");
    weekEndDisplay.innerText = "No week end date set.";
    return;
  }

  if (!forceRefresh) {
    const cachedWeekEnd = sessionStorage.getItem("weekEnd");
    if (cachedWeekEnd) {
      console.log("Using cached week end date.");
      renderWeekEnd(JSON.parse(cachedWeekEnd));
      return;
    }
  }

  console.log("Fetching week end date from Firestore.");
  try {
    const weekEndRef = doc(db, `WeekSettings/${user.uid}`);
    const weekEndSnap = await getDoc(weekEndRef);

    if (weekEndSnap.exists()) {
      const data = weekEndSnap.data();
      sessionStorage.setItem("weekEnd", JSON.stringify(data));
      renderWeekEnd(data);
    } else {
      weekEndDisplay.innerText = "Week end date not set.";
    }
  } catch (error) {
    console.error("Error fetching week end date:", error);
    weekEndDisplay.innerText = "Error loading week end date.";
  }
}

// Render functions
function renderRankings(weeklyRankings, totalRankings) {
  // Update the weekly ranking section
  weeklyRankingDiv.innerHTML = "<h3>Weekly Points</h3>";
  weeklyRankings.forEach((kid, index) => {
    const isFirstPlace = index === 0 ? "first-place" : "";
    const rankEmoji = index === 0 ? "🏆" : index < 3 ? "😭" : index + 1;
    weeklyRankingDiv.innerHTML += `
      <p class="${isFirstPlace}">
        <span class="rank-icon">${rankEmoji}</span>
        <strong>${kid.name}:</strong> ${kid.weeklyPoints} points
      </p>
    `;
  });

  // Update the total ranking section
  totalRankingDiv.innerHTML = "<h3>Total Points</h3>";
  totalRankings.forEach((kid, index) => {
    const isFirstPlace = index === 0 ? "first-place" : "";
    const rankEmoji = index === 0 ? "🏆" : index < 3 ? "😭" : index + 1;
    totalRankingDiv.innerHTML += `
      <p class="${isFirstPlace}">
        <span class="rank-icon">${rankEmoji}</span>
        <strong>${kid.name}:</strong> ${kid.totalPoints} points
      </p>
    `;
  });
}

function renderGoals(goals) {
  goalListDiv.innerHTML = "<h3>Current Goals</h3>";
  if (goals.length === 0) {
    goalListDiv.innerHTML += `
      <p style="color: #000000;">Your parents have not set a goal yet.</p>
    `;
  } else {
    goals.forEach((goal) => {
      goalListDiv.innerHTML += `
        <p><strong>${goal.id}:</strong> ${goal.goalPoints} points required</p>
      `;
    });
  }
}

function renderWeekEnd(data) {
  const rawDate = data.date; // Example: "2024-11-17"
  const [year, month, day] = rawDate.split("-");
  const formattedDate = `${month}/${day}/${year}`; // Format as MM/DD/YYYY
  weekEndDisplay.innerText = `Week ends on: ${formattedDate}`;
}

// Refresh Info Button
refreshButton.addEventListener("click", () => {
  console.log("Refreshing data from Firestore...");
  sessionStorage.clear(); // Clear the cache
  fetchRankings(true);
  fetchGoals(true);
  fetchWeekEnd(true);
});

// Initialize the app
initApp();