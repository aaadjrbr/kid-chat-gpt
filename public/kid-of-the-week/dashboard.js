import { db } from "./firebaseConfig.js";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";


const kidSelect = document.getElementById("kidSelect");
const removeKidSelect = document.getElementById("removeKidSelect");
const goalList = document.getElementById("goalList");
const weekEndDisplay = document.getElementById("weekEndDisplay");

// Modal elements
const auth = getAuth();
const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const loginModal = document.getElementById("loginModal");
const closeBtn = document.querySelector(".close");
const loginSubmit = document.getElementById("loginSubmit");

// Show the login modal
loginButton.addEventListener("click", () => {
  loginModal.style.display = "block";
});

// Hide the login modal
closeBtn.addEventListener("click", () => {
  loginModal.style.display = "none";
});

// Monitor authentication state
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log(`User logged in: ${user.uid}`);
    loginButton.style.display = "none"; // Hide login button
    logoutButton.style.display = "inline-block"; // Show logout button
    fetchKids(); // Fetch kids for the logged-in user
    fetchGoals(); // Fetch goals
    fetchWeekEnd(); // Fetch week end date
  } else {
    console.log("No user logged in");
    loginButton.style.display = "inline-block"; // Show login button
    logoutButton.style.display = "none"; // Hide logout button
    kidSelect.innerHTML = `<option value="" disabled selected>No kids available</option>`;
    removeKidSelect.innerHTML = `<option value="" disabled selected>No kids available</option>`;
  }
});
  
  // Show the login modal
  loginButton.addEventListener("click", () => {
    loginModal.style.display = "block";
  });
  
  // Hide the login modal
  closeBtn.addEventListener("click", () => {
    loginModal.style.display = "none";
  });
  
  // Handle login
  loginSubmit.addEventListener("click", async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
  
    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }
  
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      alert(`Welcome back, ${userCredential.user.email}!`);
      loginModal.style.display = "none"; // Close the modal on success
      console.log(`User logged in: ${userCredential.user.uid}`); // Log user ID
    } catch (error) {
      console.error("Error signing in:", error.message);
      alert("Login failed. Please check your credentials.");
    }
  });
  
  // Handle logout
  logoutButton.addEventListener("click", async () => {
    try {
      await signOut(auth);
      alert("You have been logged out.");
      console.log("User logged out");
    } catch (error) {
      console.error("Error signing out:", error.message);
      alert("Logout failed.");
    }
  });

// Close modal on outside click
window.addEventListener("click", (e) => {
  if (e.target === loginModal) {
    loginModal.style.display = "none";
  }
});

// Fetch and populate the kid dropdowns
async function fetchKids() {
  const user = auth.currentUser;
  if (!user) {
    console.log("User not logged in");
    return;
  }

  try {
    const kidsCollectionRef = collection(db, `Kids/${user.uid}/kids`);
    const kidsSnapshot = await getDocs(kidsCollectionRef);

    // Reset the dropdowns
    kidSelect.innerHTML = `<option value="" disabled selected>Select a kid</option>`;
    removeKidSelect.innerHTML = `<option value="" disabled selected>Select a kid</option>`;

    // Populate dropdowns with kid names
    kidsSnapshot.forEach((docSnap) => {
      const kid = docSnap.id;
      kidSelect.innerHTML += `<option value="${kid}">${kid}</option>`;
      removeKidSelect.innerHTML += `<option value="${kid}">${kid}</option>`;
    });

    console.log("Kids loaded successfully.");
  } catch (error) {
    console.error("Error fetching kids:", error.message);
  }
}

// Add a new kid
async function addKid() {
  const kidName = document.getElementById("newKidName").value.trim();

  if (!kidName) {
    alert("Please enter a valid name.");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert("You need to be logged in to add a kid.");
    return;
  }

  try {
    const kidRef = doc(db, `Kids/${user.uid}/kids/${kidName}`);
    const docSnap = await getDoc(kidRef);

    if (docSnap.exists()) {
      alert("This kid already exists.");
    } else {
      await setDoc(kidRef, { weeklyPoints: 0, totalPoints: 0 });
      alert(`Kid "${kidName}" added successfully.`);
      document.getElementById("newKidName").value = ""; // Clear the input
      fetchKids(); // Refresh the dropdowns immediately
    }
  } catch (error) {
    console.error("Error adding kid:", error.message);
    alert("Failed to add kid. Please try again.");
  }
}

// Add points to the selected kid
async function addPoints() {
  const kidName = kidSelect.value;
  const points = parseInt(document.getElementById("points").value);

  if (!kidName || isNaN(points)) {
    alert("Please select a kid and enter valid points.");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert("You need to be logged in to add points.");
    return;
  }

  const kidRef = doc(db, `Kids/${user.uid}/kids/${kidName}`);
  const docSnap = await getDoc(kidRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    await updateDoc(kidRef, {
      weeklyPoints: (data.weeklyPoints || 0) + points,
      totalPoints: (data.totalPoints || 0) + points,
    });
    alert(`Added ${points} points to ${kidName}`);
    fetchKids();
  } else {
    alert("Kid not found.");
  }
}

// Deduct points from the selected kid
async function deductPoints() {
  const kidName = kidSelect.value;
  const points = parseInt(document.getElementById("points").value);

  if (!kidName || isNaN(points)) {
    alert("Please select a kid and enter valid points.");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert("You need to be logged in to deduct points.");
    return;
  }

  const kidRef = doc(db, `Kids/${user.uid}/kids/${kidName}`);
  const docSnap = await getDoc(kidRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    const newWeeklyPoints = Math.max((data.weeklyPoints || 0) - points, 0);
    const newTotalPoints = Math.max((data.totalPoints || 0) - points, 0);

    await updateDoc(kidRef, {
      weeklyPoints: newWeeklyPoints,
      totalPoints: newTotalPoints,
    });

    alert(`Deducted ${points} points from ${kidName}`);
    fetchKids();
  } else {
    alert("Kid not found.");
  }
}

// Remove a kid
async function removeKid() {
  const kidName = removeKidSelect.value;

  if (!kidName) {
    alert("Please select a kid to remove.");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert("You need to be logged in to remove a kid.");
    return;
  }

  // Confirm deletion
  const confirmDelete = confirm(`Are you sure you want to remove "${kidName}"? This action cannot be undone.`);
  if (!confirmDelete) {
    // Exit the function if the user cancels
    return;
  }

  try {
    const kidRef = doc(db, `Kids/${user.uid}/kids/${kidName}`);
    await deleteDoc(kidRef);
    alert(`Kid "${kidName}" removed successfully.`);
    fetchKids(); // Refresh the kid list
  } catch (error) {
    console.error("Error removing kid:", error.message);
    alert("Failed to remove the kid. Please try again.");
  }
}

// Fetch and display goals for the logged-in user without using onSnapshot
async function fetchGoals() {
  const user = auth.currentUser;
  if (!user) {
    console.log("User not logged in");
    return;
  }

  try {
    const goalCollectionRef = collection(db, `Goals/${user.uid}/userGoals`);
    const goalSnapshot = await getDocs(goalCollectionRef); // Fetch goals once

    // Prepare goals for rendering
    const goals = [];
    goalSnapshot.forEach((doc) => {
      goals.push({ id: doc.id, ...doc.data() });
    });

    renderGoals(goals); // Render the fetched goals
  } catch (error) {
    console.error("Error fetching goals:", error.message);
  }
}

// Render the goals to the UI
function renderGoals(goals) {
  goalList.innerHTML = "<h3>Current Goals:</h3>";

  if (goals.length === 0) {
    goalList.innerHTML += `<p>Your parents have not set any goals yet.</p>`;
  } else {
    goals.forEach((goal) => {
      goalList.innerHTML += `
        <div>
          <p><strong>${goal.id}:</strong> ${goal.goalPoints} points</p>
          <button onclick="editGoal('${goal.id}', ${goal.goalPoints})">Edit</button>
          <button onclick="removeGoal('${goal.id}')">Remove</button>
        </div>`;
    });
  }
}

// Add a goal
async function addGoal() {
  const goalName = document.getElementById("goalName").value.trim();
  const goalPoints = parseInt(document.getElementById("goalPoints").value);

  if (!goalName || isNaN(goalPoints)) {
    alert("Please enter a valid goal name and points.");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert("You need to be logged in to add a goal.");
    return;
  }

  try {
    const goalRef = doc(db, `Goals/${user.uid}/userGoals/${goalName}`);
    const docSnap = await getDoc(goalRef);

    if (docSnap.exists()) {
      alert("This goal already exists.");
    } else {
      await setDoc(goalRef, { goalPoints });
      alert(`Goal "${goalName}" with ${goalPoints} points added.`);
      document.getElementById("goalName").value = ""; // Clear the input
      document.getElementById("goalPoints").value = ""; // Clear the input
    }
  } catch (error) {
    console.error("Error adding goal:", error.message);
    alert("Failed to add goal. Please try again.");
  }
}

// Edit a goal
async function editGoal(goalName, currentPoints) {
  const newPoints = prompt(`Edit points for "${goalName}"`, currentPoints);

  // Check if the user clicked "Cancel" or entered an invalid value
  if (newPoints === null) {
    // User clicked "Cancel," stop the function execution
    return;
  }

  if (newPoints.trim() === "" || isNaN(newPoints)) {
    alert("Please enter valid points.");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert("You need to be logged in to edit a goal.");
    return;
  }

  try {
    const goalRef = doc(db, `Goals/${user.uid}/userGoals/${goalName}`);
    await updateDoc(goalRef, { goalPoints: parseInt(newPoints) });
    alert(`Goal "${goalName}" updated.`);
  } catch (error) {
    console.error("Error updating goal:", error.message);
    alert("Failed to update goal. Please try again.");
  }
}

// Remove a goal
async function removeGoal(goalName) {
  const user = auth.currentUser;
  if (!user) {
    alert("You need to be logged in to remove a goal.");
    return;
  }

  try {
    const goalRef = doc(db, `Goals/${user.uid}/userGoals/${goalName}`);
    await deleteDoc(goalRef);
    alert(`Goal "${goalName}" removed.`);
  } catch (error) {
    console.error("Error removing goal:", error.message);
    alert("Failed to remove goal. Please try again.");
  }
}

// Set week end date
async function setWeekEnd() {
  const weekEndDate = document.getElementById("weekEndDate").value;

  if (!weekEndDate) {
    alert("Please select a valid date.");
    return;
  }

  // Format the date manually without using the Date object
  const [year, month, day] = weekEndDate.split("-"); // Extract year, month, day
  const formattedDateForAlert = `${month}/${day}/${year}`; // Format in MM/DD/YYYY

  const user = auth.currentUser;
  if (!user) {
    alert("You need to be logged in to set the week end date.");
    return;
  }

  try {
    const weekEndRef = doc(db, `WeekSettings/${user.uid}`);
    await setDoc(weekEndRef, { date: weekEndDate }); // Save as YYYY-MM-DD
    alert(`Week end date set to ${formattedDateForAlert}`);
    fetchWeekEnd(); // Refresh the displayed week end date
  } catch (error) {
    console.error("Error setting week end date:", error.message);
    alert("Failed to set week end date. Please try again.");
  }
}

// Fetch and display week end date
async function fetchWeekEnd() {
  const user = auth.currentUser;
  if (!user) {
    console.log("User not logged in");
    weekEndDisplay.innerText = "❌ No week end date set.";
    return;
  }

  try {
    const weekEndRef = doc(db, `WeekSettings/${user.uid}`);
    const weekEndSnap = await getDoc(weekEndRef);

    if (weekEndSnap.exists()) {
      const data = weekEndSnap.data();

      // Format the date manually to match the saved date format
      const rawDate = data.date; // Assuming `data.date` is in YYYY-MM-DD format
      const [year, month, day] = rawDate.split("-"); // Split into components
      const formattedDate = `${month}/${day}/${year}`; // Convert to MM/DD/YYYY

      weekEndDisplay.innerText = `⚠️ Week ends on: ${formattedDate}`;
    } else {
      weekEndDisplay.innerText = "❌ No week end date set.";
    }
  } catch (error) {
    console.error("Error fetching week end date:", error.message);
    weekEndDisplay.innerText = "Error loading week end date.";
  }
}

// Reset weekly points
async function resetWeeklyPoints() {
  const user = auth.currentUser;
  if (!user) {
    alert("You need to be logged in to reset weekly points.");
    return;
  }

  try {
    const kidsCollectionRef = collection(db, `Kids/${user.uid}/kids`);
    const kidsSnapshot = await getDocs(kidsCollectionRef);

    kidsSnapshot.forEach(async (docSnap) => {
      const kidRef = doc(db, `Kids/${user.uid}/kids/${docSnap.id}`);
      await updateDoc(kidRef, { weeklyPoints: 0 });
    });

    alert("All weekly points have been reset to zero.");
  } catch (error) {
    console.error("Error resetting weekly points:", error.message);
    alert("Failed to reset weekly points. Please try again.");
  }
}

// Reset total points for all kids
async function resetTotalPoints() {
  const user = auth.currentUser;
  if (!user) {
    alert("You need to be logged in to reset total points.");
    return;
  }

  try {
    const kidsCollectionRef = collection(db, `Kids/${user.uid}/kids`);
    const kidsSnapshot = await getDocs(kidsCollectionRef);

    // Loop through each kid and reset their total points
    kidsSnapshot.forEach(async (docSnap) => {
      const kidRef = doc(db, `Kids/${user.uid}/kids/${docSnap.id}`);
      await updateDoc(kidRef, { totalPoints: 0 });
    });

    alert("All total points have been reset to zero.");
    fetchKids(); // Refresh the kid list
  } catch (error) {
    console.error("Error resetting total points:", error.message);
    alert("Failed to reset total points. Please try again.");
  }
}

// Fetch initial data
fetchKids();
fetchGoals();
fetchWeekEnd();

window.addKid = addKid;
window.addPoints = addPoints;
window.deductPoints = deductPoints;
window.removeKid = removeKid;
window.addGoal = addGoal;
window.editGoal = editGoal;
window.removeGoal = removeGoal;
window.setWeekEnd = setWeekEnd;
window.resetWeeklyPoints = resetWeeklyPoints;
window.resetTotalPoints = resetTotalPoints;