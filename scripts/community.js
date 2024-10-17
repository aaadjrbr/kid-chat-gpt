import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, query, orderBy, limit, startAfter, getDoc, doc, updateDoc, deleteDoc, where } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js';

const postsRef = collection(db, 'posts');
const userProfilesRef = collection(db, 'userProfiles');
const videosRef = collection(db, 'videos'); // Collection for YouTube videos
let lastVisiblePost = null;
let limitNum = 5; // Number of posts to load at once
let videoIndex = 0; // To handle video navigation
let selectedCategory = 'Safety'; // Default category

// Listen for user login status
onAuthStateChanged(getAuth(), async (user) => {
  const authStatus = document.getElementById('auth-status');
  const videoForm = document.getElementById('video-form');
  
  if (user) {
    authStatus.textContent = `Logged in as: ${user.email}`;
    document.getElementById('logout-btn').style.display = 'block';
    
    // Fetch current user info and check if they are an admin
    const userRef = doc(userProfilesRef, user.uid);
    const userSnapshot = await getDoc(userRef);
    const userData = userSnapshot.data();

    if (userData && userData.isAdmin) {
      videoForm.style.display = 'block'; // Show video form for admins
    } else {
      videoForm.style.display = 'none'; // Hide video form for non-admins
    }
  } else {
    authStatus.textContent = 'Not logged in';
    document.getElementById('logout-btn').style.display = 'none';
    videoForm.style.display = 'none'; // Hide video form if not logged in or not admin
  }
});

// Fetch recent posts on page load
document.addEventListener('DOMContentLoaded', () => {
  displayCategoryMessage(selectedCategory); // Display category message on page load
  loadPostsByCategory(selectedCategory);
  loadVideos(); // Load videos on page load
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
  
  try {
    await addVideo(videoUrl); // Function to save video in Firestore
    document.getElementById('video-form').reset(); // Clear the form
    loadVideos(); // Reload the videos after posting
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

// Load YouTube videos for users to watch
async function loadVideos() {
  const querySnapshot = await getDocs(query(videosRef, orderBy('timestamp', 'desc')));
  const videos = querySnapshot.docs.map(doc => doc.data());
  if (videos.length > 0) {
    displayVideo(videos[videoIndex], videos);
  }
}

// Display a video with navigation controls (next/previous)
function displayVideo(video, videos) {
  const videoContainer = document.getElementById('video-container');
  videoContainer.innerHTML = `
  <div class="title-video1">
    <h3>${video.videoTitle || 'Untitled Video'}</h3>  <!-- Display title -->
  </div>
    <iframe width="560" height="315" src="${convertToEmbedUrl(video.videoUrl)}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
    <div class="button-next-back">
      <button id="prev-video" ${videoIndex === 0 ? 'disabled' : ''}>Previous</button>
      <button id="next-video" ${videoIndex === videos.length - 1 ? 'disabled' : ''}>Next</button>
    </div>
  `;

  // Add event listeners for next/previous buttons
  document.getElementById('prev-video').addEventListener('click', () => {
    if (videoIndex > 0) {
      videoIndex--;
      displayVideo(videos[videoIndex], videos);
    }
  });

  document.getElementById('next-video').addEventListener('click', () => {
    if (videoIndex < videos.length - 1) {
      videoIndex++;
      displayVideo(videos[videoIndex], videos);
    }
  });
}

// Convert YouTube URL to embed format
function convertToEmbedUrl(url) {
  const urlObj = new URL(url);
  const videoId = urlObj.searchParams.get('v');
  return `https://www.youtube.com/embed/${videoId}`;
}

// Fetch posts by category with pagination
async function loadPostsByCategory(category) {
    const postsContainer = document.getElementById('posts-container');
    postsContainer.innerHTML = '';  // Clear the posts container to avoid duplicates
    
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
});

// Render post with user info and replies
async function renderPost(postData, postId) {
  const userRef = doc(userProfilesRef, postData.userId);
  const userSnapshot = await getDoc(userRef);
  const userData = userSnapshot.data();

  const auth = getAuth();
  const currentUser = auth.currentUser;

  // Convert timestamp to a proper date object
  const postTime = postData.timestamp && postData.timestamp.toDate ? postData.timestamp.toDate().toLocaleString() : 'Date not available';

  // Create HTML for the post
  const postElement = document.createElement('div');
  postElement.classList.add('post');
  postElement.innerHTML = `
    <h3>${postData.postTitle}</h3>
    <p>${postData.postContent}</p>
    <div class="author">Posted by: ${userData.name} on ${postTime} ${userData.isAdmin ? '<span class="admin-tag">Admin 👑</span>' : ''}</div>
    ${postData.edited ? '<div class="edited">Edited</div>' : ''}
    <div class="post-controls"></div>
    <button class="reply-btn">Reply</button>
    <div class="replies-container"></div>
  `;

  const postControls = postElement.querySelector('.post-controls');

  // Show "Edit" and "Delete" buttons only if current user is the author or if the current user is an admin
  if (currentUser && (currentUser.uid === postData.userId || currentUser.isAdmin)) {
    postControls.innerHTML = `
      <button class="edit-btn">Edit</button>
      <button class="delete-btn">Delete</button>
    `;
    
    const editButton = postElement.querySelector('.edit-btn');
    const deleteButton = postElement.querySelector('.delete-btn');

    editButton.addEventListener('click', () => editPost(postId, postData.postContent));
    deleteButton.addEventListener('click', () => {
      if (confirm('⚠️ Are you sure you want to delete this post?')) deletePost(postId);
    });
  }

  // Append the post to the posts container
  document.getElementById('posts-container').appendChild(postElement);

  // Add event listener for reply
  const replyButton = postElement.querySelector('.reply-btn');
  const repliesContainer = postElement.querySelector('.replies-container');
  replyButton.addEventListener('click', () => handleReply(postId, repliesContainer));

  // Display replies
  renderReplies(postData.replies, repliesContainer, postId);
}

// Render replies with pagination (first 3 replies by default)
async function renderReplies(replies, container, postId, limitNum = 3) {
  container.innerHTML = ''; // Clear previous replies
  const repliesToShow = replies.slice(0, limitNum);
  
  const auth = getAuth();
  const currentUser = auth.currentUser;

  for (let reply of repliesToShow) {
    // Properly format the reply timestamp
    const replyTime = reply.timestamp && reply.timestamp.toDate ? reply.timestamp.toDate().toLocaleString() : 'Date not available';
    const replyUserRef = doc(userProfilesRef, reply.userId);
    const replyUserSnapshot = await getDoc(replyUserRef);
    const replyUserData = replyUserSnapshot.data();
    
    const replyElement = document.createElement('div');
    replyElement.classList.add('reply');
    replyElement.innerHTML = `
      <p>${reply.replyContent}</p>
      <div class="author">
        Replied by: ${replyUserData.name} on ${replyTime} <br><br> ${replyUserData.isAdmin ? '<span class="admin-tag">Admin 👑</span>' : ' <br>'}
      </div>
      <div class="reply-controls"></div>
    `;

    const replyControls = replyElement.querySelector('.reply-controls');

    // Show "Edit" and "Delete Reply" buttons only if current user is the reply author or post author or if the current user is an admin
    if (currentUser && (currentUser.uid === reply.userId || currentUser.uid === postId || currentUser.isAdmin)) {
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

  // If there are more replies, show a "Load More" button
  if (replies.length > limitNum) {
    const loadMoreButton = document.createElement('button');
    loadMoreButton.textContent = 'Load More Replies';
    loadMoreButton.addEventListener('click', () => {
      renderReplies(replies, container, postId, limitNum + 3);
    });
    container.appendChild(loadMoreButton);
  }
}

// Handle reply editing
async function editReply(postId, replyToEdit, container) {
  const newContent = prompt('Edit your reply:', replyToEdit.replyContent);
  if (!newContent) return;

  const postRef = doc(postsRef, postId);
  const postSnapshot = await getDoc(postRef);
  const postData = postSnapshot.data();

  const updatedReplies = postData.replies.map((reply) =>
    reply === replyToEdit ? { ...reply, replyContent: newContent } : reply
  );

  await updateDoc(postRef, {
    replies: updatedReplies,
  });

  renderReplies(updatedReplies, container, postId);
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
async function editPost(postId, currentContent) {
  const newContent = prompt('Edit your post:', currentContent);
  if (!newContent) return;

  const postRef = doc(postsRef, postId);
  await updateDoc(postRef, {
    postContent: newContent,
    edited: true
  });

  document.getElementById('posts-container').innerHTML = ''; // Clear posts
  loadPostsByCategory(selectedCategory); // Reload posts after editing
}

// Delete post function
async function deletePost(postId) {
  const postRef = doc(postsRef, postId);
  await deleteDoc(postRef);

  document.getElementById('posts-container').innerHTML = ''; // Clear posts
  loadPostsByCategory(selectedCategory); // Reload posts after deletion
}
