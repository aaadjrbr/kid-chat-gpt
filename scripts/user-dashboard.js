import { db } from './firebase-config.js';
import { getDocs, collection, updateDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";

// Check if the user is logged in
const auth = getAuth();

document.addEventListener('DOMContentLoaded', () => {
    const userContainer = document.getElementById('user-container');
    const searchBar = document.getElementById('search-bar');
    const userCountElement = document.getElementById('user-count');
    let users = [];

    // Only fetch users if the user is authenticated
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log('User is logged in:', user.uid); // User is authenticated
            fetchUsers(); // Fetch the users only when authenticated
        } else {
            console.log('No user is logged in.');
            alert('You need to log in to view the users.');
            // Optionally redirect to a login page
        }
    });

    async function fetchUsers() {
        try {
            const usersSnapshot = await getDocs(collection(db, 'userProfiles'));
            users = usersSnapshot.docs.map(userDoc => ({
                id: userDoc.id,
                ...userDoc.data()
            }));
            
            console.log('Fetched Users:', users); // Add this line to debug
    
            displayUsers(users); // Display the users
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    }    

    function displayUsers(usersToDisplay) {
        userContainer.innerHTML = '';
        userCountElement.textContent = `Total Users: ${usersToDisplay.length}`;
    
        usersToDisplay.forEach(user => {
            const userBox = document.createElement('div');
            userBox.classList.add('user-box');
            userBox.innerHTML = `
                <img src="${user.profilePicture || 'https://via.placeholder.com/50'}" alt="Profile Picture">
                <h3>${user.name}</h3>
                <p>Email: ${user.email}</p>
                <p>Phone: ${user.phone}</p>
                <p>Status: ${user.isGold ? 'Gold Member' : user.isPremium ? 'Premium Member' : 'Free Member'}</p>
                <p>Tokens Left: ${user.tokens || 0}</p>
                <div id="kids-list">
                    ${user.kids?.map(kid => `<p>Kid: ${kid}</p>`).join('') || ''}
                </div>
                <button class="btn-refill">Instant Refill</button>
                <button class="btn-free">Change to Free Member</button>
                <button class="btn-premium">Change to Premium Member</button>
                <button class="btn-gold">Change to Gold Member</button>
                <button class="btn-remove">Remove User</button>
            `;
            
            // Add event listeners for each button after creating them
            const removeButton = userBox.querySelector('.btn-remove');
            removeButton.addEventListener('click', () => removeUser(user.id));
            
            const goldButton = userBox.querySelector('.btn-gold');
            goldButton.addEventListener('click', () => updateStatus(user.id, 'gold'));
            
            const premiumButton = userBox.querySelector('.btn-premium');
            premiumButton.addEventListener('click', () => updateStatus(user.id, 'premium'));
            
            const freeButton = userBox.querySelector('.btn-free');
            freeButton.addEventListener('click', () => updateStatus(user.id, 'free'));
    
            userContainer.appendChild(userBox);
        });
    }    

    searchBar.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredUsers = users.filter(user => user.name.toLowerCase().includes(searchTerm));
        displayUsers(filteredUsers);
    });

    window.refillTokens = async function(userId) {
        try {
            await updateDoc(doc(db, 'userProfiles', userId), {
                tokens: 30
            });
            alert('Tokens refilled!');
            fetchUsers();
        } catch (error) {
            console.error('Error refilling tokens:', error);
        }
    };    

    window.updateStatus = async function(userId, status) {
        try {
            const updates = {
                isGold: false,
                isPremium: false
            };
    
            if (status === 'gold') {
                updates.isGold = true;
            } else if (status === 'premium') {
                updates.isPremium = true;
            }
    
            await updateDoc(doc(db, 'userProfiles', userId), updates);
            alert('Status updated successfully!');
            fetchUsers(); // Refresh the list of users
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };
    
    window.removeUser = async function(userId) {
        if (confirm('Are you sure you want to remove this user?')) {
            try {
                await deleteDoc(doc(db, 'userProfiles', userId));
                alert('User removed successfully!');
                fetchUsers(); // Refresh the list of users
            } catch (error) {
                console.error('Error removing user:', error);
            }
        }
    };
    
});
