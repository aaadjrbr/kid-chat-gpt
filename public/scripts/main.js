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

// Detect Instagram Browser and Notify User
function isInstagramBrowser() {
  return navigator.userAgent.includes("Instagram");
}

function notifyInstagramBrowser() {
  if (isInstagramBrowser()) {
      const message = document.createElement("div");
      message.style.position = "fixed";
      message.style.top = "0";
      message.style.left = "0";
      message.style.width = "100%";
      message.style.padding = "1em";
      message.style.backgroundColor = "#FFD700";
      message.style.color = "#333";
      message.style.textAlign = "center";
      message.style.zIndex = "1000";
      message.innerHTML = `
          <p style="margin: 0;">
              For a better experience, please open this page in your browser.
              <a href="${window.location.href}" style="font-weight: bold; color: #000;">Open in Browser</a>
          </p>
      `;
      document.body.appendChild(message);
  }
}

// Call the function to notify if Instagram browser detected
notifyInstagramBrowser();

// Smooth Scroll
function scrollToSection(selector) {
  document.querySelector(selector).scrollIntoView({ behavior: 'smooth' });
}

// Function to generate floating stars with enhancements
const createFloatingStars = () => {
  const starContainer = document.querySelector('.floating-stars');
  const screenWidth = window.innerWidth;
  const numberOfStars = screenWidth > 1200 ? 150 : screenWidth > 768 ? 100 : 50;

  starContainer.innerHTML = ''; // Clear existing stars

  for (let i = 0; i < numberOfStars; i++) {
      const star = document.createElement('div');
      star.classList.add('star');

      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      star.style.animationDuration = `${Math.random() * 5 + 3}s`;
      star.style.animationTimingFunction = 'ease-in-out';
      star.style.transform = `scale(${Math.random() * 0.8 + 0.2})`;
      star.style.opacity = `${Math.random() * 0.8 + 0.2}`;
      const starColor = Math.random() < 0.5 ? 'rgba(255, 255, 255, 0.8)' : 'rgba(173, 216, 230, 0.8)';
      star.style.backgroundColor = starColor;
      starContainer.appendChild(star);
  }
};

let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(createFloatingStars, 200);
});
createFloatingStars();

// Go to the top button
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Toggle the visibility of the button
window.addEventListener('scroll', () => {
  const goToTopButton = document.getElementById('goToTopButton');
  if (window.scrollY > 100) { 
      goToTopButton.classList.add('show');
  } else {
      goToTopButton.classList.remove('show');
  }
});
