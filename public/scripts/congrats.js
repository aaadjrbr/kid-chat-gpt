// Import Firebase config from 'firebase-config.js'
import { auth, db } from './firebase-config.js';  // Ensure this points to your actual config file

// Ensure the user is authenticated
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const userId = user.uid;
        
        console.log(`User ID (UID): ${userId}`);

        // Extract session_id from the URL
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');
        const functionUrl = "https://us-central1-kids-chatgpt.cloudfunctions.net/fetchSessionDetails";

        if (sessionId) {
            try {
                const response = await fetch(`${functionUrl}?session_id=${sessionId}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch session details');
                }

                const sessionDetails = await response.json();
                
                if (sessionDetails.line_items && sessionDetails.line_items[0]) {
                    const priceId = sessionDetails.line_items[0].price.id;

                    // Check if the user profile exists, if not, create it
                    const userProfileRef = db.collection('userProfiles').doc(userId);
                    const userProfile = await userProfileRef.get();

                    if (!userProfile.exists) {
                        console.log(`Creating user profile for user ${userId}`);
                        await userProfileRef.set({
                            email: user.email,  // Add additional fields as necessary
                            isPremium: false,
                            isGold: false,
                            tokens: 0  // Default token value
                        });
                    }

                    // Update Firestore based on the subscription
                    if (priceId === 'price_1QCKrVE9KmsmeowF1pJMrn6q') {
                        await userProfileRef.update({
                            isPremium: true,
                            isGold: false,
                            tokens: 30  // Set 30 tokens for Premium
                        });
                    } else if (priceId === 'price_1QCKcUE9KmsmeowFdkoIStHU') {
                        await userProfileRef.update({
                            isPremium: false,
                            isGold: true,
                            tokens: 20  // Set 20 tokens for Gold
                        });
                    }

                    console.log(`Updated subscription status and tokens for user ${userId}`);
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
