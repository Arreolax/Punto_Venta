//sidebar
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const menuIcon = menuBtn?.querySelector("i");

menuBtn?.addEventListener("click", () => {
  sidebar.classList.toggle("-translate-x-full");
  overlay.classList.toggle("hidden");

  const isOpen = !sidebar.classList.contains("-translate-x-full");
  
  if (isOpen) {
    menuIcon.classList.replace("fa-bars", "fa-xmark");
  } else {
    menuIcon.classList.replace("fa-xmark", "fa-bars");
  }
});

overlay?.addEventListener("click", () => {
  sidebar.classList.add("-translate-x-full");
  overlay.classList.add("hidden");
  
  if (menuIcon) {
    menuIcon.classList.replace("fa-xmark", "fa-bars");
  }
});

// USER MENU
const userToggle = document.getElementById("userMenuToggle");
const userMenu = document.getElementById("userMenu");

userToggle?.addEventListener("click", () => {
  userMenu.classList.toggle("opacity-0");
  userMenu.classList.toggle("scale-95");
  userMenu.classList.toggle("pointer-events-none");
});

//Header Menu
document.addEventListener('DOMContentLoaded', () => {
  const topMenuBtn = document.getElementById('topMenuBtn');
  const mobileTopMenu = document.getElementById('mobileTopMenu');

  if (topMenuBtn && mobileTopMenu) {
    topMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      mobileTopMenu.classList.toggle('-translate-y-full');
      mobileTopMenu.classList.toggle('opacity-0');
      mobileTopMenu.classList.toggle('pointer-events-none');
    });

    document.addEventListener('click', (e) => {
      if (!mobileTopMenu.contains(e.target) && !topMenuBtn.contains(e.target)) {
        mobileTopMenu.classList.add('-translate-y-full', 'opacity-0', 'pointer-events-none');
      }
    });
  }
});