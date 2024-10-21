// Import Firebase config from your 'firebase-config.js'
import { auth, db } from './firebase-config.js';  // Adjust path if needed

// Ensure the user is authenticated
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const userId = user.uid;
        
        // Display the UID in the console
        console.log(`User ID (UID): ${userId}`);

        // Extract session_id from the URL
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');
        const functionUrl = "https://us-central1-kids-chatgpt.cloudfunctions.net/fetchSessionDetails";

        if (sessionId) {
            // Call the Firebase Function to get session details
            try {
                const response = await fetch(`${functionUrl}?session_id=${sessionId}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch session details');
                }

                const sessionDetails = await response.json();
                
                // Make sure sessionDetails contains line_items
                if (sessionDetails.line_items && sessionDetails.line_items[0]) {
                    const priceId = sessionDetails.line_items[0].price.id;

                    // Update Firestore based on the subscription
                    if (priceId === 'price_1QCKrVE9KmsmeowF1pJMrn6q') {
                        await db.collection('userProfiles').doc(userId).update({
                            isPremium: true,
                            isGold: false
                        });
                    } else if (priceId === 'price_1QCKcUE9KmsmeowFdkoIStHU') {
                        await db.collection('userProfiles').doc(userId).update({
                            isPremium: false,
                            isGold: true
                        });
                    }

                    console.log(`Updated subscription status for user ${userId}`);
                } else {
                    console.error('Session details do not contain line_items');
                }
            } catch (error) {
                console.error('Error fetching session details:', error);
            }
        } else {
            console.error('Session ID not found in URL.');
        }
    } else {
        console.error('User is not logged in.');
    }
});
