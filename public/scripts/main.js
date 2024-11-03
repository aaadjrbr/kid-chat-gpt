function toggleNavbar() {
  const navbarMenu = document.getElementById("navbarMenu");
  navbarMenu.classList.toggle("active");

  // If the menu is opened, set a timeout to close it after 5 seconds
  if (navbarMenu.classList.contains("active")) {
      setTimeout(() => {
          navbarMenu.classList.remove("active");
      }, 5000); // 5000 milliseconds = 5 seconds
  }
}

AOS.init();

// Sticky Menu on Scroll
window.onscroll = function () {
  const navbar = document.getElementById("mainNavbar");
  const stickyMenu = document.getElementById("stickyMenu");
  const scrollPos = window.pageYOffset;

  if (scrollPos > 100) {
      navbar.style.transform = "translateY(-100%)";
      stickyMenu.classList.add("show"); // Add class to show with fade-in effect
  } else {
      navbar.style.transform = "translateY(0)";
      stickyMenu.classList.remove("show"); // Remove class to hide with fade-out effect
  }
};

// Smooth Scroll
function scrollToSection(selector) {
  document.querySelector(selector).scrollIntoView({ behavior: 'smooth' });
}

// Function to generate floating stars with enhancements
const createFloatingStars = () => {
  const starContainer = document.querySelector('.floating-stars');
  const screenWidth = window.innerWidth;

  // Determine the number of stars based on screen width
  const numberOfStars = screenWidth > 1200 ? 150 : screenWidth > 768 ? 100 : 50;

  // Clear existing stars
  starContainer.innerHTML = '';

  for (let i = 0; i < numberOfStars; i++) {
      const star = document.createElement('div');
      star.classList.add('star');

      // Randomize position
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;

      // Randomize animation duration and easing for floating effect
      star.style.animationDuration = `${Math.random() * 5 + 3}s`;
      star.style.animationTimingFunction = 'ease-in-out';

      // Adjust star size and opacity for variety
      star.style.transform = `scale(${Math.random() * 0.8 + 0.2})`;
      star.style.opacity = `${Math.random() * 0.8 + 0.2}`;

      // Subtle color variation for a natural look
      const starColor = Math.random() < 0.5 ? 'rgba(255, 255, 255, 0.8)' : 'rgba(173, 216, 230, 0.8)';
      star.style.backgroundColor = starColor;

      // Append each star to the container
      starContainer.appendChild(star);
  }
};

// Debounce function for resize events
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(createFloatingStars, 200);
});

// Initial call to create stars
createFloatingStars();