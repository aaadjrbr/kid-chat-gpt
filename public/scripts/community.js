import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, query, orderBy, limit, startAfter, getDoc, doc, updateDoc, deleteDoc, where } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js';

const postsRef = collection(db, 'posts');
const userProfilesRef = collection(db, 'userProfiles');
const videosRef = collection(db, 'videos'); // Collection for YouTube videos
let lastVisiblePost = null;
let limitNum = 5; // Number of posts to load at once
let videoLimit = 5; // Show 5 videos at a time
let selectedCategory = 'Safety'; // Default category
let loadedVideos = []; // Store loaded videos for pagination
let lastVisibleVideo = null;
let globalUserData = null;

// Listen for user login status
onAuthStateChanged(getAuth(), async (user) => {
  const authStatus = document.getElementById('auth-status');
  const videoForm = document.getElementById('video-form'); 

  if (user) {
    authStatus.textContent = `Logged in as: ${user.email}`;
    document.getElementById('logout-btn').style.display = 'block';

    const userRef = doc(userProfilesRef, user.uid);
    const userSnapshot = await getDoc(userRef);

    if (userSnapshot.exists()) {
      globalUserData = userSnapshot.data();
      console.log('Fetched user data:', globalUserData); // Log for debugging

      // Make sure globalUserData and isAdmin are checked correctly
      if (globalUserData?.isAdmin) {
        videoForm.style.display = 'block'; // Show video form for admins
        console.log('User is admin'); // Log for debugging
      } else {
        videoForm.style.display = 'none'; // Hide video form for non-admins
        console.log('User is not admin or globalUserData is not set'); // Log if not admin
      }

      // Toggle delete buttons for admins
      toggleDeleteButtonsForAdmin(); // Call the function to show buttons for admin
    } else {
      console.error('User profile not found in Firestore.');
    }
  } else {
    authStatus.textContent = 'Not logged in';
    document.getElementById('logout-btn').style.display = 'none';
    videoForm.style.display = 'none'; // Hide video form if not logged in or not admin
    globalUserData = null; // Clear userData when not logged in
  }
});

// Fetch recent posts and load videos with pagination on page load
document.addEventListener('DOMContentLoaded', () => {
  displayCategoryMessage(selectedCategory); // Display category message on page load
  loadPostsByCategory(selectedCategory);
  loadVideosWithPagination(); // Load videos with pagination on page load
});

// Display selected category message
function displayCategoryMessage(category) {
  const categoryMessage = document.getElementById('category-message');
  categoryMessage.textContent = `You are seeing posts of: ${category}`;
}

// Handle video submission by admins
document.getElementById('video-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const videoUrl = document.getElementById('video-url').value;
  const videoTitle = document.getElementById('video-title').value; // Fetch video title

  try {
    await addVideo(videoUrl, videoTitle); // Function to save video in Firestore
    document.getElementById('video-form').reset(); // Clear the form
    // Reset pagination and reload videos
    lastVisibleVideo = null;
    loadedVideos = [];
    loadVideosWithPagination();
  } catch (error) {
    console.error('Error adding video:', error);
  }
});

// Handle post creation form submission
document.getElementById('post-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const postTitle = document.getElementById('post-title').value;
  const postContent = document.getElementById('post-content').value;
  const postCategory = document.getElementById('post-category').value;

  try {
    await createPost(postTitle, postContent, postCategory);
    document.getElementById('post-form').reset(); // Clear form after submission
    loadPostsByCategory(postCategory); // Reload posts after submission
  } catch (error) {
    console.error('Error creating post:', error);
  }
});

// Create a post with category
async function createPost(postTitle, postContent, postCategory) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return alert('Please login to post');

  const post = {
    userId: user.uid,
    postTitle,
    postContent,
    postCategory,  // Store the category
    timestamp: new Date(),
    edited: false,
    replies: [],
  };

  await addDoc(postsRef, post);
  alert('Post created!');
}

// Add a video (Admin only)
async function addVideo(videoUrl, videoTitle) {
  const auth = getAuth();
  const user = auth.currentUser;

  // Fetch the user profile to check if they are an admin
  const userRef = doc(userProfilesRef, user.uid);
  const userSnapshot = await getDoc(userRef);
  const userData = userSnapshot.data();

  if (!user || !userData.isAdmin) {
    return alert('Only admins can post videos');
  }

  const video = {
    videoUrl,
    videoTitle,  // Include the title
    timestamp: new Date(),
  };

  await addDoc(videosRef, video);
  alert('Video posted!');
}

// Load YouTube videos with pagination
async function loadVideosWithPagination() {
  const videoContainer = document.getElementById('video-container');
  
  if (!videoContainer) {
    console.error('Video container not found');
    return;
  }

  if (!lastVisibleVideo) {
    videoContainer.innerHTML = ''; // Clear previous videos on initial load or reset
    loadedVideos = []; // Reset loadedVideos when starting a new load
  }

  let q = query(videosRef, orderBy('timestamp', 'desc'), limit(videoLimit));
  if (lastVisibleVideo) {
    q = query(videosRef, orderBy('timestamp', 'desc'), startAfter(lastVisibleVideo), limit(videoLimit));
  }

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    if (!lastVisibleVideo) {
      videoContainer.innerHTML = '<p>No videos to display</p>';
    } else {
      const noMoreMsg = document.createElement('p');
      noMoreMsg.textContent = '❌ No more videos to display';
      videoContainer.appendChild(noMoreMsg);
    }
    document.getElementById('load-more-videos-btn').style.display = 'none';
  } else {
    querySnapshot.forEach((doc) => {
      const video = doc.data();
      const videoId = doc.id; // Get the document ID
      loadedVideos.push(video); // Store all loaded videos
      const videoElement = createVideoElement(video, videoId); // Pass the videoId for deletion
      videoContainer.appendChild(videoElement);
    });

    lastVisibleVideo = querySnapshot.docs[querySnapshot.docs.length - 1];

    if (querySnapshot.size < videoLimit) {
      document.getElementById('load-more-videos-btn').style.display = 'none';
      const noMoreMsg = document.createElement('p');
      noMoreMsg.textContent = '❌ No more videos to display';
      videoContainer.appendChild(noMoreMsg);
    } else {
      document.getElementById('load-more-videos-btn').style.display = 'block';
    }
  }

  // Show "Hide Videos" button if there are more than 5 videos
  if (loadedVideos.length > 5) {
    document.getElementById('hide-videos-btn').style.display = 'block';
  }
}

// Hide back to first 5 videos
function hideVideosToFirstBatch() {
  const videoContainer = document.getElementById('video-container');
  videoContainer.innerHTML = ''; // Clear all current videos
  
  // Only show the first 5 videos from the loadedVideos array
  const firstFiveVideos = loadedVideos.slice(0, 5);
  
  firstFiveVideos.forEach((video, index) => {
    const videoId = `video-${index}`;
    const videoElement = createVideoElement(video, videoId);
    videoContainer.appendChild(videoElement);
  });

  // Reset the "Load More" button since we are back to first batch
  document.getElementById('load-more-videos-btn').style.display = 'block';

  // Hide "Hide Videos" button after reverting back to the first 5 videos
  document.getElementById('hide-videos-btn').style.display = 'none';
}

// Add event listener for "Hide" button to hide extra videos and show first 5
document.getElementById('hide-videos-btn').addEventListener('click', () => {
  hideVideosToFirstBatch();
});

// Create video elements with delete option hidden by default
function createVideoElement(video, videoId) {
  const videoElement = document.createElement('div');
  videoElement.classList.add('video-block');
  
  videoElement.innerHTML = `
    <br>
    <h4>${video.videoTitle || 'Untitled Video'}</h4>
    <iframe width="560" height="315" src="${convertToEmbedUrl(video.videoUrl)}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
    <br>
  `;

  // Create the delete button and hide it by default
  const deleteButton = document.createElement('button');
  deleteButton.textContent = '🗑️ Delete 👆 ▶️';
  deleteButton.classList.add('delete-video-btn');
  deleteButton.style.display = 'none'; // Initially hide the button

  deleteButton.addEventListener('click', () => deleteVideo(videoId, videoElement)); // Attach event to delete video
  videoElement.appendChild(deleteButton); // Append the delete button after the title and video

  return videoElement;
}

// Function to toggle delete buttons visibility for admins
function toggleDeleteButtonsForAdmin() {
  if (globalUserData && globalUserData.isAdmin) {
    const deleteButtons = document.querySelectorAll('.delete-video-btn');
    deleteButtons.forEach(button => {
      button.style.display = 'inline-block'; // Show the button if user is admin
    });
  }
}


async function deleteVideo(videoId, videoElement) {
  if (!confirm('Are you sure you want to delete this video?')) return;

  try {
    await deleteDoc(doc(videosRef, videoId)); // Delete the video from Firestore
    videoElement.remove(); // Remove the video element from the DOM
    alert('Video deleted successfully!');
  } catch (error) {
    console.error('Error deleting video:', error);
    alert('Failed to delete the video. Please try again.');
  }
}

// Add event listener for "Load More" button
document.getElementById('load-more-videos-btn').addEventListener('click', () => {
  loadVideosWithPagination();
});

// Event listener for "Hide" button to reset back to 5 recent videos
document.getElementById('hide-videos-btn').addEventListener('click', () => {
  const videoContainer = document.getElementById('video-container');
  if (videoContainer) {
    videoContainer.innerHTML = ''; // Clear all loaded videos
    // Reset pagination
    lastVisibleVideo = null;
    loadedVideos = [];
    loadVideosWithPagination(); // Reload the first batch
    // Show "Load More" button again
    document.getElementById('load-more-videos-btn').style.display = 'block';
    // Remove "No more videos" message if present
    const noMoreMsg = videoContainer.querySelector('p');
    if (noMoreMsg && noMoreMsg.textContent === '❌ No more videos to display') {
      noMoreMsg.remove();
    }
  }
});

// Convert YouTube URL to embed format
function convertToEmbedUrl(url) {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    const videoId = urlObj.searchParams.get('v'); // Extract the video ID from the YouTube URL
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`; // Convert it to an embed URL
    } else {
      // Handle youtu.be URLs or other formats
      const pathname = urlObj.pathname;
      if (pathname.startsWith('/embed/')) {
        return url; // Already in embed format
      } else if (pathname.startsWith('/')) {
        return `https://www.youtube.com/embed/${pathname.slice(1)}`;
      } else {
        return '';
      }
    }
  } catch (error) {
    console.error('Invalid URL format:', url);
    return '';
  }
}

// Fetch posts by category with pagination
async function loadPostsByCategory(category) {
  const postsContainer = document.getElementById('posts-container');
  if (!postsContainer) {
    console.error('Posts container not found');
    return;
  }

  // If changing category, reset pagination
  if (category !== selectedCategory) {
    postsContainer.innerHTML = '';  // Clear the posts container to avoid duplicates
    lastVisiblePost = null;
  }

  let q = query(postsRef, where('postCategory', '==', category), orderBy('timestamp', 'desc'), limit(limitNum));
  if (lastVisiblePost) {
    q = query(postsRef, where('postCategory', '==', category), orderBy('timestamp', 'desc'), startAfter(lastVisiblePost), limit(limitNum));
  }

  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty && !lastVisiblePost) {
    postsContainer.innerHTML = '<p>❌ No posts found</p>';
  } else {
    querySnapshot.forEach((doc) => {
      renderPost(doc.data(), doc.id);
    });

    // Update the last visible post for pagination
    if (querySnapshot.docs.length > 0) {
      lastVisiblePost = querySnapshot.docs[querySnapshot.docs.length - 1];
    }

    // If no more posts are available
    if (querySnapshot.size < limitNum) {
      const loadMoreBtn = document.getElementById('load-more-btn');
      loadMoreBtn.disabled = true;  // Disable the button if no more posts
      loadMoreBtn.textContent = '✅ No more posts to load';
    }
  }
}

// Event listener for category selection and filtering
document.getElementById('filter-btn').addEventListener('click', () => {
  selectedCategory = document.getElementById('category-select').value;
  displayCategoryMessage(selectedCategory); // Update the category message
  lastVisiblePost = null;  // Reset pagination when category changes
  
  // Reset Load More button
  const loadMoreBtn = document.getElementById('load-more-btn');
  loadMoreBtn.disabled = false;
  loadMoreBtn.textContent = '✨ Load More Posts';

  loadPostsByCategory(selectedCategory);  // Load posts based on the selected category

  // Scroll to the create-post section
  document.getElementById('posts-container').scrollIntoView({
    behavior: 'smooth' // Adds a smooth scrolling animation
  });
});

// Handle adding a reply to a post
async function handleReply(postId, repliesContainer) {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) return alert('Please log in to reply.');

  // Check if the reply box already exists
  let replyBox = repliesContainer.previousElementSibling?.classList.contains('reply-box')
    ? repliesContainer.previousElementSibling
    : null;

  // Toggle reply box visibility
  if (replyBox) {
    replyBox.remove(); // If the reply box is already present, remove it (hide it)
  } else {
    // Create the reply box
    replyBox = document.createElement('div');
    replyBox.classList.add('reply-box');
    replyBox.innerHTML = `
      <textarea placeholder="Write your reply here..." class="reply-input"></textarea>
      <button class="submit-reply-btn">Submit Reply</button>
    `;
    
    // Insert the reply box above the replies
    repliesContainer.insertAdjacentElement('beforebegin', replyBox);

    // Add event listener for submitting the reply
    replyBox.querySelector('.submit-reply-btn').addEventListener('click', async () => {
      const replyContent = replyBox.querySelector('.reply-input').value;
      if (!replyContent) return alert('Please enter a reply');

      const postRef = doc(postsRef, postId);
      const postSnapshot = await getDoc(postRef);
      const postData = postSnapshot.data();

      const newReply = {
        userId: user.uid,
        replyContent: replyContent,
        timestamp: new Date(),
      };

      // Add the new reply to the existing replies array
      const updatedReplies = [...postData.replies, newReply];

      // Update the post document with the new reply
      await updateDoc(postRef, {
        replies: updatedReplies,
      });

      // Clear the input box
      replyBox.querySelector('.reply-input').value = '';

      // Automatically show the latest 3 replies
      await renderReplies(updatedReplies, repliesContainer, postId);

      // Automatically show the comments after a reply is submitted
      repliesContainer.querySelector('.replies-list').style.display = 'block';
      repliesContainer.querySelector('.see-comments-btn').style.display = 'none';
      repliesContainer.querySelector('.hide-comments-btn').style.display = 'inline';
    });
  }
}

// Render post with user info and replies
async function renderPost(postData, postId) {
  const userRef = doc(userProfilesRef, postData.userId);
  const userSnapshot = await getDoc(userRef);
  const userData = userSnapshot.data();

  const auth = getAuth();
  const currentUser = auth.currentUser;

  const postTime = postData.timestamp && postData.timestamp.toDate ? postData.timestamp.toDate().toLocaleString() : 'Date not available';

  // Create HTML for the post
  const postElement = document.createElement('div');
  postElement.classList.add('post');

  // Check if the user has a profile picture
  const profilePictureUrl = userData.profilePicture || 'https://firebasestorage.googleapis.com/v0/b/kids-chatgpt.appspot.com/o/default-profile.webp?alt=media&token=8f1f9033-90a1-42c6-9845-aefd87fb6fdd';  // Fallback to default if no picture

  postElement.innerHTML = `
    <div class="post-header">
    <h4 class="author" style="text-align: right !important;">${userData.isAdmin ? '<span class="admin-tag">Admin 👑</span>' : ''}</h4>
      <br>
      <div class="post-info">
        <img src="${profilePictureUrl}" class="profile-picture" alt="Profile Picture">
        <h2>${userData.name}</h2>
      </div>
    </div>
    <h3>${postData.postTitle}</h3>
    <p>${postData.postContent}</p>
    <div class="author">${postTime}</div>
    ${postData.edited ? '<div class="edited">Edited</div>' : ''}
    <div class="post-controls"></div>
    <button class="reply-btn">Reply</button>
    <div class="replies-container"></div>
  `;

  const postControls = postElement.querySelector('.post-controls');

  if (currentUser && (currentUser.uid === postData.userId || currentUser.isAdmin)) {
    postControls.innerHTML = `
      <button class="edit-btn">Edit</button>
      <button class="delete-btn">Delete</button>
    `;

    const editButton = postElement.querySelector('.edit-btn');
    const deleteButton = postElement.querySelector('.delete-btn');

    // Add null checks before attaching event listeners
    if (editButton) {
      editButton.addEventListener('click', () => editPost(postId, postData.postContent, postElement));
    }
    if (deleteButton) {
      deleteButton.addEventListener('click', () => {
        if (confirm('⚠️ Are you sure you want to delete this post?')) deletePost(postId);
      });
    }
  }

  document.getElementById('posts-container').appendChild(postElement);

  const replyButton = postElement.querySelector('.reply-btn');
  const repliesContainer = postElement.querySelector('.replies-container');

  // Add null check before attaching event listener
  if (replyButton) {
    replyButton.addEventListener('click', () => handleReply(postId, repliesContainer));
  }

  // Initially, display "See comments" button if there are replies
  if (postData.replies && postData.replies.length > 0) {
    repliesContainer.innerHTML = `
      <button class="see-comments-btn">See comments</button>
      <button class="hide-comments-btn" style="display: none;">Hide comments</button>
      <div class="replies-list" style="display: none;"></div>
    `;
  } else {
    repliesContainer.innerHTML = '<p>No replies yet</p>';
  }
  
  const seeCommentsButton = repliesContainer.querySelector('.see-comments-btn');
  const hideCommentsButton = repliesContainer.querySelector('.hide-comments-btn');
  const repliesList = repliesContainer.querySelector('.replies-list');

  // Make sure the buttons exist before accessing their styles
  if (seeCommentsButton) {
    seeCommentsButton.style.display = 'inline';
    seeCommentsButton.addEventListener('click', async () => {
      seeCommentsButton.style.display = 'none'; // Hide the "See comments" button
      hideCommentsButton.style.display = 'inline'; // Show the "Hide comments" button
      repliesList.style.display = 'block'; // Show replies
  
      // Load and display replies only the first time the button is clicked
      if (!repliesList.hasChildNodes()) {
        await renderReplies(postData.replies, repliesList, postId); // Show replies
      }
    });
  }
  
  // Handle hiding replies when "Hide comments" is clicked
  if (hideCommentsButton) {
    hideCommentsButton.addEventListener('click', () => {
      hideCommentsButton.style.display = 'none'; // Hide the "Hide comments" button
      seeCommentsButton.style.display = 'inline'; // Show the "See comments" button
      repliesList.style.display = 'none'; // Hide replies
    });
  }
}

// Function to delete a post
async function deletePost(postId) {
  try {
    const postRef = doc(postsRef, postId);
    await deleteDoc(postRef); // Delete the post from Firestore
    alert('Post deleted successfully! Refresh the page.');
    
    // Optionally, you can remove the post from the DOM here
    const postElement = document.querySelector(`[data-post-id="${postId}"]`);
    if (postElement) {
      postElement.remove(); // Remove post element from the DOM
    }
  } catch (error) {
    console.error('Error deleting post:', error);
    alert('Failed to delete the post. Please try again.');
  }
}

// Render replies with pagination (first 3 replies by default)
async function renderReplies(replies, container, postId, limitNum = 2) {
  container.innerHTML = ''; // Clear previous replies

  // Check if there are replies
  if (replies.length === 0) {
    container.innerHTML = '<p>No replies yet</p>';
    return;
  }

  const sortedReplies = replies.sort((a, b) => {
    const aTime = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
    const bTime = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
    return bTime - aTime;
  });

  const repliesToShow = sortedReplies.slice(0, limitNum);

  const auth = getAuth();
  const currentUser = auth.currentUser;

  for (let reply of repliesToShow) {
    // Fetch user data for the reply author
    const replyUserRef = doc(userProfilesRef, reply.userId);
    const replyUserSnapshot = await getDoc(replyUserRef);
    const replyUserData = replyUserSnapshot.exists() ? replyUserSnapshot.data() : null;

    if (!replyUserData) {
      console.error("Error fetching user data for reply:", reply);
      continue; // Skip if user data is not available
    }

    // Properly format the reply timestamp
    const replyTime = reply.timestamp instanceof Date
      ? reply.timestamp.toLocaleString()
      : reply.timestamp?.toDate?.().toLocaleString() || 'Date not available';

    // Use the user's profile picture, or a default if not available
    const profilePictureUrl = replyUserData.profilePicture || 'https://firebasestorage.googleapis.com/v0/b/kids-chatgpt.appspot.com/o/default-profile.webp?alt=media&token=8f1f9033-90a1-42c6-9845-aefd87fb6fdd';

    // Create the reply element
    const replyElement = document.createElement('div');
    replyElement.classList.add('reply');
    replyElement.setAttribute('data-reply-id', reply.timestamp);  // Unique ID for each reply

    replyElement.innerHTML = `
    <div class="reply-header">
        <h4 class="admin-tag" style="text-align: right !important;">${replyUserData.isAdmin ? 'Admin 👑' : ''}</h4>
        <br>
        <img src="${profilePictureUrl}" class="profile-picture-reply" alt="Profile Picture">
        <div class="reply-info">
          <h4>${replyUserData.name}</h4>
        </div>
      </div>
      <br>
      <p>${reply.replyContent}</p>
      <div class="reply-time">${replyTime}</div>
      <br/>
      <div class="reply-controls"></div>
    `;

    const replyControls = replyElement.querySelector('.reply-controls');
    if (currentUser && (currentUser.uid === reply.userId || currentUser.isAdmin)) {
      replyControls.innerHTML = `
        <button class="edit-reply-btn">Edit</button>
        <button class="delete-reply-btn">Delete</button>
      `;

      const editReplyButton = replyElement.querySelector('.edit-reply-btn');
      const deleteReplyButton = replyElement.querySelector('.delete-reply-btn');

      editReplyButton.addEventListener('click', () => editReply(postId, reply, container));
      deleteReplyButton.addEventListener('click', () => {
        if (confirm('⚠️ Are you sure you want to delete this reply?')) handleDeleteReply(postId, reply, replies, container);
      });
    }

    container.appendChild(replyElement);
  }

  // Show "Load More Replies" if there are more replies
  if (replies.length > limitNum) {
    const loadMoreButton = document.createElement('button');
    loadMoreButton.textContent = 'Load More Replies';
    loadMoreButton.addEventListener('click', () => {
      renderReplies(replies, container, postId, limitNum + 2);
    });
    container.appendChild(loadMoreButton);
  }

  // Ensure "Hide comments" button stays visible after rendering replies
  const hideCommentsButton = container.parentElement.querySelector('.hide-comments-btn');
  const seeCommentsButton = container.parentElement.querySelector('.see-comments-btn');

  if (hideCommentsButton) {
    hideCommentsButton.style.display = 'inline';  // Ensure the hide button is visible
  }
  
  if (seeCommentsButton) {
    seeCommentsButton.style.display = 'none';  // Ensure the see button is hidden
  }

  // Add event listener for hiding replies again
  hideCommentsButton?.addEventListener('click', () => {
    hideCommentsButton.style.display = 'none';  // Hide the hide button
    seeCommentsButton.style.display = 'inline';  // Show the see button
    container.style.display = 'none';  // Hide replies
  });
}

// Handle reply editing
async function editReply(postId, replyToEdit, container) {
  // Find the reply content element
  const replyElement = container.querySelector(`.reply[data-reply-id="${replyToEdit.timestamp}"]`);
  const originalContentElement = replyElement.querySelector('p');

  // Check if an edit box already exists
  let editBox = replyElement.querySelector('.edit-reply-box');

  // Toggle edit box visibility
  if (editBox) {
    editBox.remove(); // If the edit box is already present, remove it (hide it)
    originalContentElement.style.display = 'block'; // Show the original reply content again
  } else {
    // Hide the original reply content
    originalContentElement.style.display = 'none';

    // Create the edit box
    editBox = document.createElement('div');
    editBox.classList.add('edit-reply-box');
    editBox.innerHTML = `
      <br>
      <textarea class="edit-reply-input">${replyToEdit.replyContent}</textarea>
      <button class="submit-edit-reply-btn">Save Changes</button>
      <button class="cancel-edit-reply-btn">Cancel</button>
    `;

    // Insert the edit box before the original reply content
    originalContentElement.insertAdjacentElement('beforebegin', editBox);

    // Handle saving changes
    editBox.querySelector('.submit-edit-reply-btn').addEventListener('click', async () => {
      const newContent = editBox.querySelector('.edit-reply-input').value;
      if (!newContent) return alert('Please enter your reply content.');

      const postRef = doc(postsRef, postId);
      const postSnapshot = await getDoc(postRef);
      const postData = postSnapshot.data();

      const updatedReplies = postData.replies.map((reply) =>
        reply === replyToEdit ? { ...reply, replyContent: newContent } : reply
      );

      // Update the post document with the new replies
      await updateDoc(postRef, {
        replies: updatedReplies,
      });

      // Re-render the replies after editing
      renderReplies(updatedReplies, container, postId);
    });

    // Handle canceling the edit
    editBox.querySelector('.cancel-edit-reply-btn').addEventListener('click', () => {
      editBox.remove(); // Remove the edit box if canceled
      originalContentElement.style.display = 'block'; // Show the original reply content again
    });
  }
}

// Handle reply deletion
async function handleDeleteReply(postId, replyToDelete, replies, container) {
  const postRef = doc(postsRef, postId);
  const updatedReplies = replies.filter(reply => reply !== replyToDelete);

  await updateDoc(postRef, {
    replies: updatedReplies
  });

  renderReplies(updatedReplies, container, postId);
}

// Load more posts when 'Load More' button is clicked
document.getElementById('load-more-btn').addEventListener('click', () => {
  loadPostsByCategory(selectedCategory); // Load more posts within the selected category
});

// Edit post function
async function editPost(postId, currentContent, postElement) {
  // Find the post content element
  const postContentElement = postElement.querySelector('p');

  // Check if an edit box already exists
  let editBox = postElement.querySelector('.edit-box');

  // Toggle edit box visibility
  if (editBox) {
    editBox.remove(); // If the edit box is already present, remove it (hide it)
    postContentElement.style.display = 'block'; // Show the original content again
  } else {
    // Hide the original post content
    postContentElement.style.display = 'none';

    // Create the edit box
    editBox = document.createElement('div');
    editBox.classList.add('edit-box');
    editBox.innerHTML = `
      <textarea class="edit-post-input">${currentContent}</textarea>
      <button class="submit-edit-post-btn">Save Changes</button>
      <button class="cancel-edit-post-btn">Cancel</button>
    `;

    // Insert the edit box before the original content
    postContentElement.insertAdjacentElement('beforebegin', editBox);

    // Handle saving changes
    editBox.querySelector('.submit-edit-post-btn').addEventListener('click', async () => {
      const newContent = editBox.querySelector('.edit-post-input').value;
      if (!newContent) return alert('Please enter post content.');

      const postRef = doc(postsRef, postId);

      // Update the post in Firestore
      await updateDoc(postRef, {
        postContent: newContent,
        edited: true
      });

      // Remove the edit box and re-render the updated post content
      editBox.remove();
      postContentElement.textContent = newContent;
      postContentElement.style.display = 'block'; // Show the updated content

      // Optionally, show a message that the post was successfully edited
      alert('Post updated successfully!');
    });

    // Handle canceling the edit
    editBox.querySelector('.cancel-edit-post-btn').addEventListener('click', () => {
      editBox.remove(); // Remove the edit box if canceled
      postContentElement.style.display = 'block'; // Show the original content again
    });
  }
}