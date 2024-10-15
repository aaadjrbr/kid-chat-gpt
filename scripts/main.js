document.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', function(event) {
      event.preventDefault(); // Prevent immediate navigation
      document.body.classList.add('fade-out'); // Add fade-out effect
      setTimeout(() => {
        window.location.href = this.href; // Redirect after fade-out completes
      }, 500); // Match the CSS transition duration
    });
  });