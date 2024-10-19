// Initialize AOS (Animate on Scroll)
AOS.init();

// Function to generate floating stars with improvements
const createFloatingStars = () => {
  const starContainer = document.querySelector('.floating-stars');
  const screenWidth = window.innerWidth;

  // Dynamic number of stars based on screen width
  const numberOfStars = screenWidth > 1200 ? 150 : screenWidth > 768 ? 100 : 50;

  // Clear existing stars if any
  starContainer.innerHTML = '';

  for (let i = 0; i < numberOfStars; i++) {
    const star = document.createElement('div');
    star.classList.add('star');

    // Set random position and animation
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    star.style.animationDuration = Math.random() * 8 + 5 + 's'; // Vary animation time
    star.style.opacity = Math.random(); // Random opacity for twinkling effect
    star.style.transform = `scale(${Math.random() * 0.6 + 0.3})`; // Different star sizes

    // Append to container
    starContainer.appendChild(star);
  }
};

// Call the function to create stars
createFloatingStars();

// Recreate stars on window resize for responsiveness
window.addEventListener('resize', createFloatingStars);