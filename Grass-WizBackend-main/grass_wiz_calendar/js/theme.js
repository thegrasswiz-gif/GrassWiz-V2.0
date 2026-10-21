// Theme, dark mode and settings dropdown


// Event wiring — called once from app.js after the user is signed in.
function initTheme() {
  
  $('settingsBtn').onclick = (e) => {
    e.stopPropagation();
    $('settingsDropdown').classList.toggle('open');
  };
  document.addEventListener('click', (e) => {
    if(!$('settingsBtn').contains(e.target) && !$('settingsDropdown').contains(e.target)) {
        $('settingsDropdown').classList.remove('open');
    }
  });

  const savedTheme = localStorage.getItem('gw_theme') || 'theme-grasswiz';
  changeTheme(savedTheme);
  
  const darkModeToggle = $('darkModeToggle');
  if (localStorage.getItem('gw_darkMode') === 'true') {
    document.body.classList.add('dark-mode');
    darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  }
  darkModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isNowDark = document.body.classList.contains('dark-mode');
    darkModeToggle.innerHTML = isNowDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    localStorage.setItem('gw_darkMode', isNowDark);
  });
}

// Theme Changer Function
function changeTheme(themeName) {
    document.body.className = themeName;
    if(localStorage.getItem('gw_darkMode') === 'true') {
        document.body.classList.add('dark-mode');
    }
    localStorage.setItem('gw_theme', themeName);
    
    // Update active state in dropdown
    document.querySelectorAll('.theme-option').forEach(btn => {
        btn.classList.remove('active');
        if(btn.dataset.theme === themeName) btn.classList.add('active');
    });
    $('settingsDropdown').classList.remove('open');
}
