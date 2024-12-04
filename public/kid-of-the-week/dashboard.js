import { db } from "./firebaseConfig.js";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
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
    } else {
      console.log("No user logged in");
      loginButton.style.display = "inline-block"; // Show login button
      logoutButton.style.display = "none"; // Hide logout button
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
  const kidsSnapshot = await getDocs(collection(db, "kids"));
  kidSelect.innerHTML = `<option value="" disabled selected>Select a kid</option>`;
  removeKidSelect.innerHTML = `<option value="" disabled selected>Select a kid</option>`;

  kidsSnapshot.forEach((docSnap) => {
    const kid = docSnap.id;
    kidSelect.innerHTML += `<option value="${kid}">${kid}</option>`;
    removeKidSelect.innerHTML += `<option value="${kid}">${kid}</option>`;
  });
}

// Add a new kid
async function addKid() {
  const kidName = document.getElementById("newKidName").value.trim();

  if (!kidName) {
    alert("Please enter a valid name.");
    return;
  }

  const kidRef = doc(db, "kids", kidName);
  const docSnap = await getDoc(kidRef);

  if (docSnap.exists()) {
    alert("This kid already exists.");
  } else {
    await setDoc(kidRef, { weeklyPoints: 0, totalPoints: 0 });
    alert(`Kid "${kidName}" added successfully.`);
    document.getElementById("newKidName").value = "";
    fetchKids();
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

  const kidRef = doc(db, "kids", kidName);
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
  
    const kidRef = doc(db, "kids", kidName);
    const docSnap = await getDoc(kidRef);
  
    if (docSnap.exists()) {
      const data = docSnap.data();
  
      // Deduct points but ensure it doesn't go below zero
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

  const kidRef = doc(db, "kids", kidName);
  await deleteDoc(kidRef);
  alert(`Kid "${kidName}" removed successfully.`);
  fetchKids();
}

// Add a goal
async function addGoal() {
  const goalName = document.getElementById("goalName").value.trim();
  const goalPoints = parseInt(document.getElementById("goalPoints").value);

  if (!goalName || isNaN(goalPoints)) {
    alert("Please enter a valid goal name and points.");
    return;
  }

  const goalRef = doc(db, "goals", goalName);
  await setDoc(goalRef, { goalPoints });

  alert(`Goal "${goalName}" with ${goalPoints} points added.`);
  document.getElementById("goalName").value = "";
  document.getElementById("goalPoints").value = "";
  fetchGoals();
}

// Edit or remove goals dynamically
function fetchGoals() {
  const goalRef = collection(db, "goals");

  onSnapshot(goalRef, (snapshot) => {
    goalList.innerHTML = "<h3>Current Goals:</h3>";
    snapshot.forEach((doc) => {
      const data = doc.data();
      goalList.innerHTML += `
        <div>
          <p><strong>${doc.id}:</strong> ${data.goalPoints} points</p>
          <button onclick="editGoal('${doc.id}', ${data.goalPoints})">Edit</button>
          <button onclick="removeGoal('${doc.id}')">Remove</button>
        </div>`;
    });
  });
}

// Edit a goal
async function editGoal(goalName, currentPoints) {
  const newPoints = prompt(`Edit points for "${goalName}"`, currentPoints);
  if (newPoints && !isNaN(newPoints)) {
    const goalRef = doc(db, "goals", goalName);
    await updateDoc(goalRef, { goalPoints: parseInt(newPoints) });
    alert(`Goal "${goalName}" updated.`);
  }
}

// Remove a goal
async function removeGoal(goalName) {
  const goalRef = doc(db, "goals", goalName);
  await deleteDoc(goalRef);
  alert(`Goal "${goalName}" removed.`);
}

// Set week end date
async function setWeekEnd() {
  const weekEndDate = document.getElementById("weekEndDate").value;
  if (!weekEndDate) {
    alert("Please select a valid date.");
    return;
  }

  const weekEndRef = doc(db, "settings", "weekEnd");
  await setDoc(weekEndRef, { date: weekEndDate });
  alert(`Week end date set to ${weekEndDate}`);
  fetchWeekEnd();
}

// Fetch and display week end date
async function fetchWeekEnd() {
  const weekEndRef = doc(db, "settings", "weekEnd");
  const weekEndSnap = await getDoc(weekEndRef);

  if (weekEndSnap.exists()) {
    const data = weekEndSnap.data();
    weekEndDisplay.innerText = `Week ends on: ${data.date}`;
  } else {
    weekEndDisplay.innerText = "No week end date set.";
  }
}

// Reset weekly points
async function resetWeeklyPoints() {
  const kidsSnapshot = await getDocs(collection(db, "kids"));

  kidsSnapshot.forEach(async (docSnap) => {
    const kidRef = doc(db, "kids", docSnap.id);
    await updateDoc(kidRef, { weeklyPoints: 0 });
  });

  alert("All weekly points have been reset to zero.");
}

// Reset total points for all kids
async function resetTotalPoints() {
  try {
    const kidsSnapshot = await getDocs(collection(db, "kids"));

    kidsSnapshot.forEach(async (docSnap) => {
      const kidRef = doc(db, "kids", docSnap.id);
      await updateDoc(kidRef, { totalPoints: 0 });
    });

    alert("All total points have been reset to zero.");
    fetchKids(); // Refresh the kid list
  } catch (error) {
    console.error("Error resetting total points:", error);
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