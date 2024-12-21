import { db, auth, functions } from "./firebaseConfig.js"; // Include functions
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-functions.js";
import { collection, doc, getDoc, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
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
    kidSelect.innerHTML = '<option value="">Select your name</option>';
    snapshot.forEach((doc) => {
      const kid = doc.data();
      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = kid.name;
      kidSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error fetching kids:", error);
    alert("❌ Failed to fetch names. Please try again.");
  }
}

// Fetch and display balance and history for the selected kid
async function fetchKidData(kidId) {
  try {
    const kidDoc = await getDoc(doc(bankRef, kidId));
    if (kidDoc.exists()) {
      const kidData = kidDoc.data();
      balanceAmount.textContent = `$${kidData.balance}`; // Update the balance display
      displayFilteredHistory(kidData.history || {}); // Update the history display
    } else {
      alert("❌ Kid data not found!");
    }
  } catch (error) {
    console.error("Error fetching kid data:", error);
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

async function processTransaction(transactionData) {
  try {
    const processTransactionFn = httpsCallable(functions, "processTransaction");

    const result = await processTransactionFn(transactionData);

    if (result.data.success) {
      alert(result.data.message);
      console.log("Transaction succeeded:", result.data);

      // Refetch the kid's data to update the balance and history
      const selectedKidId = kidSelect.value;
      if (selectedKidId) {
        await fetchKidData(selectedKidId);
      }
    } else {
      alert("Transaction failed.");
    }
  } catch (error) {
    console.error("Transaction failed:", error);
    alert("Transaction failed: " + error.message);
  }
}

function displayFilteredHistory(history) {
  const selectedMonth = filterMonth.value;
  const selectedYear = filterYear.value;

  historyList.innerHTML = "";
  const monthlyHistory = history[selectedYear]?.[selectedMonth] || [];

  if (monthlyHistory.length === 0) {
    historyList.innerHTML = "<li>❌ No history for the selected period.</li>";
  } else {
    // Sort by timestamp (most recent first)
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
        entry.type === "Transfer Sent" ? "Transfer Sent 📤" : entry.type === "Transfer Received" ? "Transfer Received 📥" : entry.type === "add" ? "Deposited 💰" : "Withdrew 💸"
      } $${Math.abs(entry.change)} (Prior: $${entry.priorBalance}) - Total: $${totalBalance}`;

      // Add a class based on transaction type
      listItem.classList.add(entry.type === "Transfer Sent" ? "transfer-sent" : entry.type === "Transfer Received" ? "transfer-received" : entry.type === "add" ? "deposit" : "withdraw");

      historyList.appendChild(listItem);
    });
  }
}

// DOM Elements
const scanQrButton = document.getElementById("scan-qr");
const closeQrReaderButton = document.getElementById("close-qr-reader");
const qrReaderDiv = document.getElementById("qr-reader");

// QR Code Reader Functionality
let selectedCameraId = null; // Global variable to store the selected camera ID
let html5QrCode = null; // Global QR scanner instance

async function startQrScanner(selectedPayerKidId) {
  if (typeof Html5Qrcode === "undefined") {
    console.error("Html5Qrcode library is not loaded!");
    alert("QR scanner library is not available. Please reload the page.");
    return;
  }

  try {
    // Prevent duplicate scanner instances
    if (html5QrCode) {
      console.warn("QR Scanner is already initialized.");
      return;
    }

    // Initialize Html5Qrcode instance once
    html5QrCode = new Html5Qrcode("qr-reader");

    // Check if the camera has already been selected
    if (!selectedCameraId) {
      const cameras = await Html5Qrcode.getCameras();

      if (cameras.length === 0) {
        alert("❌ No cameras found on this device.");
        return;
      }

      if (cameras.length === 1) {
        selectedCameraId = cameras[0].id; // Automatically select the only available camera
      } else {
        const cameraOptions = cameras.map((camera, index) => `${index + 1}: ${camera.label}`);
        const choice = prompt(
          `📷 Multiple cameras found:\n${cameraOptions.join("\n")}\n\nEnter the number of the camera you want to use:`
        );

        const selectedIndex = parseInt(choice, 10) - 1;
        if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= cameras.length) {
          alert("❌ Invalid selection. Please try again.");
          return;
        }

        selectedCameraId = cameras[selectedIndex].id;
      }
    }

    // Start the QR scanner
    qrReaderDiv.style.display = "block"; // Show QR reader div
    closeQrReaderButton.style.display = "inline"; // Show close button

    await html5QrCode.start(
      { deviceId: { exact: selectedCameraId } },
      { fps: 10, qrbox: 250 },
      async (decodedText) => {
        console.log("QR code scanned:", decodedText);
        handleScannedData(decodedText, selectedPayerKidId);
        await html5QrCode.stop();
        html5QrCode = null; // Reset the instance
        qrReaderDiv.style.display = "none";
        closeQrReaderButton.style.display = "none";
      },
      (errorMessage) => {
        // Suppress repetitive warnings about "No MultiFormat Readers"
        if (!errorMessage.includes("No MultiFormat Readers were able to detect the code")) {
          console.warn("QR code scanning error:", errorMessage);
        }
      }
    );

    closeQrReaderButton.addEventListener(
      "click",
      async () => {
        if (html5QrCode) {
          await html5QrCode.stop();
          html5QrCode = null; // Reset the instance
        }
        qrReaderDiv.style.display = "none"; // Hide QR reader div
        closeQrReaderButton.style.display = "none"; // Hide close button
      },
      { once: true } // Ensure the listener is added only once
    );
  } catch (error) {
    console.error("Error initializing QR scanner:", error);
    alert("❌ Failed to start QR scanner. Please check your camera permissions.");
    if (html5QrCode) {
      await html5QrCode.stop();
      html5QrCode = null;
    }
  }
}

scanQrButton.addEventListener("click", () => {
  startQrScanner();
});

function showScanPopup(message, confirmCallback, cancelCallback) {
  // Create the overlay
  const overlay = document.createElement("div");
  overlay.classList.add("scan-popup-overlay");

  // Create the popup container
  const popupContainer = document.createElement("div");
  popupContainer.classList.add("scan-popup-container");

  // Create the message div
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("scan-popup-message");
  messageDiv.innerHTML = message; // Use innerHTML to render HTML content
  popupContainer.appendChild(messageDiv);

  // Create the button container
  const buttonContainer = document.createElement("div");
  buttonContainer.classList.add("scan-popup-buttons");

  // Create the confirm button
  const confirmButton = document.createElement("button");
  confirmButton.textContent = "✅ Confirm";
  confirmButton.classList.add("scan-popup-button", "confirm");
  confirmButton.addEventListener("click", () => {
    // Remove both the overlay and the popup container
    document.body.removeChild(overlay);
    document.body.removeChild(popupContainer);
    if (confirmCallback) confirmCallback();
  });

  // Create the cancel button
  const cancelButton = document.createElement("button");
  cancelButton.textContent = "❌ Cancel";
  cancelButton.classList.add("scan-popup-button", "cancel");
  cancelButton.addEventListener("click", () => {
    // Remove both the overlay and the popup container
    document.body.removeChild(overlay);
    document.body.removeChild(popupContainer);
    if (cancelCallback) cancelCallback();
  });

  // Append buttons to the button container
  buttonContainer.appendChild(confirmButton);
  buttonContainer.appendChild(cancelButton);

  // Append button container to the popup container
  popupContainer.appendChild(buttonContainer);

  // Append the overlay and popup container to the body
  document.body.appendChild(overlay);
  document.body.appendChild(popupContainer);
}

async function handleScannedData(decodedText) {
  let transactionData;

  try {
    transactionData = JSON.parse(decodedText);
  } catch (error) {
    console.error("Invalid QR code data:", error);
    showScanPopup("❌ Invalid QR code scanned. Please try again.");
    return;
  }

  const { to, toName, receiverParentId, amount, timestamp } = transactionData;

  if (!to || !toName || !receiverParentId || !amount || !timestamp) {
    showScanPopup("❌ Scanned data is incomplete. Please try again.");
    return;
  }

  try {
    // Fetch all kids under the current parent
    const snapshot = await getDocs(bankRef);

    if (snapshot.empty) {
      alert("⚠️ No kids found. Cannot proceed.");
      return;
    }

    const kidsList = [];
    snapshot.forEach((doc) => {
      const kid = doc.data();
      kidsList.push({ id: doc.id, name: kid.name });
    });

    // Display a prompt to select the payer
    const numberedList = kidsList
      .map((kid, index) => `${index + 1}. ${kid.name}`)
      .join("\n");

    const choice = prompt(
      `🤑 Who is paying? Enter the number corresponding to the kid:\n\n${numberedList}`
    );

    const selectedIndex = parseInt(choice, 10) - 1;
    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= kidsList.length) {
      alert("❌ Invalid selection. Please try again.");
      return;
    }

    const payerId = kidsList[selectedIndex].id;
    const payerName = kidsList[selectedIndex].name;

    // Prevent self-payment if the payer and receiver are the same
    if (payerId === to) {
      alert("❌ Payer and receiver cannot be the same. Please select a different payer.");
      return;
    }

    // Add payer information to transactionData
    transactionData.from = payerId;
    transactionData.fromName = payerName;

    console.log("Transaction Data with Names:", transactionData);

    // Confirm and process the transaction
    showScanPopup(
      `👤 <strong>Payee:</strong> ${toName} (${to})<br>
       🤑 <strong>Payer:</strong> ${payerName} (${payerId})<br>
       💸 <strong>Amount:</strong> $${amount.toFixed(2)}<br><br>
       Are you sure you want to complete this transaction?`,
      () => {
        processTransaction(transactionData)
          .then(() => {
            showScanPopup("🎉 Payment completed successfully!");
          })
          .catch((err) => {
            console.error("Transaction failed:", err);
            showScanPopup("❌ Payment failed. Please try again.");
          });
      },
      () => {
        showScanPopup("❌ Payment cancelled.");
      }
    );
  } catch (error) {
    console.error("Error fetching payer options:", error);
    alert("❌ Failed to fetch payer information. Please try again.");
  }
}

// DOM Elements
const generateQrButton = document.getElementById("generate-qr");
const qrCodeContainer = document.getElementById("qr-code-container");

generateQrButton.addEventListener("click", async () => {
  const selectedKidId = kidSelect.value; // Receiver kid ID
  const selectedKidName = kidSelect.options[kidSelect.selectedIndex]?.textContent; // Receiver kid name

  if (!selectedKidId) {
    showPopup("⚠️ Please select the receiver's name first.");
    return;
  }

  // Ask for the amount in a popup
  const amount = await showInputPopup("💸 Enter the amount to request:");

  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    showPopup("⚠️ Please enter a valid positive amount.");
    return;
  }

  try {
    const parentId = auth.currentUser.uid; // Current logged-in user's parentId
    const kidDoc = await getDoc(doc(db, `bank/${parentId}/kids/${selectedKidId}`));

    if (!kidDoc.exists) {
      showPopup("❌ Receiver not found.");
      return;
    }

    const receiverParentId = parentId; // Use the authenticated user's parentId
    const receiverName = kidDoc.data().name; // Fetch the name from Firestore

    if (!receiverParentId || !receiverName) {
      console.error("Receiver's data is incomplete.");
      showPopup("❌ Receiver information is missing.");
      return;
    }

    // Transaction data for QR code
    const transactionData = {
      to: selectedKidId,
      toName: receiverName, // Receiver's name
      amount: parseFloat(amount),
      receiverParentId: receiverParentId,
      timestamp: Date.now(),
    };
    console.log("Transaction Data for QR Code:", transactionData);

    // Show the QR code in a popup
    showQrCodePopup(transactionData, selectedKidName);
  } catch (error) {
    console.error("Error generating QR code:", error);
    showPopup("❌ Failed to generate QR code. Please try again.");
  }
});

// Function to show a simple message popup
function showPopup(message) {
  const overlay = document.createElement("div");
  overlay.classList.add("popup-overlay");

  const popupContainer = document.createElement("div");
  popupContainer.classList.add("popup-container");

  const messageDiv = document.createElement("div");
  messageDiv.classList.add("popup-message");
  messageDiv.textContent = message;
  popupContainer.appendChild(messageDiv);

  const closeButton = document.createElement("button");
  closeButton.classList.add("popup-close-button");
  closeButton.textContent = "❌ Close";
  closeButton.addEventListener("click", () => {
    document.body.removeChild(overlay);
  });
  popupContainer.appendChild(closeButton);

  overlay.appendChild(popupContainer);
  document.body.appendChild(overlay);
}

// Function to show an input popup
function showInputPopup(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.classList.add("popup-overlay");

    const popupContainer = document.createElement("div");
    popupContainer.classList.add("popup-container");

    const messageDiv = document.createElement("div");
    messageDiv.classList.add("popup-message");
    messageDiv.textContent = message;
    popupContainer.appendChild(messageDiv);

    const input = document.createElement("input");
    input.type = "number";
    input.placeholder = "Enter amount";
    input.classList.add("popup-input");
    popupContainer.appendChild(input);

    const buttonContainer = document.createElement("div");
    buttonContainer.classList.add("popup-button-container");

    const confirmButton = document.createElement("button");
    confirmButton.classList.add("popup-confirm-button");
    confirmButton.textContent = "✅ Confirm";
    confirmButton.addEventListener("click", () => {
      const amount = input.value.trim();
      document.body.removeChild(overlay);
      resolve(amount);
    });
    buttonContainer.appendChild(confirmButton);

    const cancelButton = document.createElement("button");
    cancelButton.classList.add("popup-cancel-button");
    cancelButton.textContent = "❌ Cancel";
    cancelButton.addEventListener("click", () => {
      document.body.removeChild(overlay);
      resolve(null);
    });
    buttonContainer.appendChild(cancelButton);

    popupContainer.appendChild(buttonContainer);
    overlay.appendChild(popupContainer);
    document.body.appendChild(overlay);
  });
}

// Function to show the QR code in a popup
function showQrCodePopup(transactionData, selectedKidName) {
  const overlay = document.createElement("div");
  overlay.classList.add("qr-popup-overlay");

  const popupContainer = document.createElement("div");
  popupContainer.classList.add("qr-popup-container");

  const qrCodeCanvas = document.createElement("canvas");
  qrCodeCanvas.id = "qr-code";
  qrCodeCanvas.classList.add("qr-code-canvas");

  // Add a loading message
  const loader = document.createElement("div");
  loader.classList.add("qr-popup-loader");
  loader.textContent = "🔄 Generating QR Code...";
  popupContainer.appendChild(loader);

  // Generate the QR code
  setTimeout(() => {
    loader.remove(); // Remove the loading message
    QRCode.toCanvas(
      qrCodeCanvas,
      JSON.stringify(transactionData),
      {
        errorCorrectionLevel: "H",
        color: {
          dark: "#6908a2d9", // Purple color for QR code
          light: "#FFFFFF", // White background
        },
      },
      (error) => {
        if (error) {
          console.error("QR code generation error:", error);
          showPopup("❌ Failed to generate QR code. Please try again.");
          return;
        }

        console.log("🎉 QR code generated successfully!");

        // Add download and share options
        const qrCodeDataUrl = qrCodeCanvas.toDataURL("image/png");

        // Download link
        const downloadLink = document.createElement("a");
        downloadLink.href = qrCodeDataUrl;
        downloadLink.download = `qr-code-${selectedKidName || "unknown"}.png`;
        downloadLink.textContent = "⬇️ Download QR Code";
        downloadLink.classList.add("qr-popup-download-link");
        popupContainer.appendChild(downloadLink);

        // Share button
        const shareButton = document.createElement("button");
        shareButton.textContent = "📤 Share QR Code";
        shareButton.classList.add("qr-popup-share-button");

        shareButton.addEventListener("click", async () => {
          try {
            if (navigator.share) {
              const response = await fetch(qrCodeDataUrl);
              const qrCodeBlob = await response.blob();

              await navigator.share({
                title: "Payment Request QR Code",
                text: `Requesting $${transactionData.amount.toFixed(
                  2
                )} for ${selectedKidName || "Unknown"}`,
                files: [
                  new File(
                    [qrCodeBlob],
                    `qr-code-${selectedKidName || "unknown"}.png`,
                    { type: "image/png" }
                  ),
                ],
              });
            } else {
              showPopup("📤 Sharing not supported on this device.");
            }
          } catch (err) {
            console.error("❌ Sharing failed:", err);
            showPopup("❌ Sharing failed. Please try again.");
          }
        });

        popupContainer.appendChild(shareButton);

        // Add a close button
        const closeButton = document.createElement("button");
        closeButton.textContent = "❌ Close";
        closeButton.classList.add("qr-popup-close-button");
        closeButton.addEventListener("click", () => {
          document.body.removeChild(overlay);
        });
        popupContainer.appendChild(closeButton);
      }
    );
  }, 1500);

  // Append the canvas to the popup container
  popupContainer.appendChild(qrCodeCanvas);

  // Append the overlay and popup container to the body
  overlay.appendChild(popupContainer);
  document.body.appendChild(overlay);
}

// Define selectPayer function to allow user to select the payer
async function selectPayer() {
  const snapshot = await getDocs(bankRef);

  if (snapshot.empty) {
    alert("⚠️ No kids found. Please add a kid first.");
    return null;
  }

  let kidsList = [];
  snapshot.forEach((doc, index) => {
    const kid = doc.data();
    kidsList.push({ id: doc.id, name: kid.name });
  });

  const numberedList = kidsList
    .map((kid, index) => `${index + 1}. ${kid.name}`)
    .join("\n");

  const choice = prompt(
    `🤑 Who is paying? Enter the number corresponding to the kid:\n\n${numberedList}`
  );

  const selectedIndex = parseInt(choice, 10) - 1;
  if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= kidsList.length) {
    alert("❌ Invalid selection. Please try again.");
    return null;
  }

  return kidsList[selectedIndex];
}

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