// components.js - Settings and Navigation Menu Components

document.addEventListener('DOMContentLoaded', function() {
    // ============================================
    // SETTINGS MENU COMPONENT
    // ============================================
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsMenu = document.getElementById('settingsMenu');

    if (settingsBtn && settingsMenu) {
        // Settings Dropdown Toggle
        settingsBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            settingsMenu.classList.toggle('active');
            
            // Close burger menu if open
            const burgerMenu = document.getElementById('burgerMenu');
            if (burgerMenu) {
                burgerMenu.classList.remove('active');
            }
        });

        // Close settings when clicking outside
        document.addEventListener('click', function(e) {
            if (!settingsMenu.contains(e.target) && !settingsBtn.contains(e.target)) {
                settingsMenu.classList.remove('active');
            }
        });

        // Close settings menu on Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                settingsMenu.classList.remove('active');
            }
        });

        // Sound Toggle
        const soundToggle = document.getElementById('soundToggle');
        if (soundToggle) {
            // Load saved preference
            const savedSound = localStorage.getItem('sound_enabled');
            if (savedSound !== null) {
                soundToggle.checked = savedSound === 'true';
            }

            soundToggle.addEventListener('change', function() {
                const isEnabled = this.checked;
                localStorage.setItem('sound_enabled', isEnabled);
                console.log('Sound:', isEnabled ? 'Enabled' : 'Disabled');
            });
        }

        // Volume Slider
        const volumeSlider = document.getElementById('volumeSlider');
        const volumeValue = document.getElementById('volumeValue');

        if (volumeSlider && volumeValue) {
            // Load saved preference
            const savedVolume = localStorage.getItem('volume');
            if (savedVolume) {
                volumeSlider.value = savedVolume;
                volumeValue.textContent = savedVolume;
            }

            volumeSlider.addEventListener('input', function() {
                volumeValue.textContent = this.value;
                localStorage.setItem('volume', this.value);
                console.log('Volume:', this.value);
            });
        }

        // Voice Selection
        const boyVoice = document.getElementById('boyVoice');
        const girlVoice = document.getElementById('girlVoice');

        function selectVoice(voice) {
            if (voice === 'boy') {
                boyVoice.classList.add('active');
                girlVoice.classList.remove('active');
            } else {
                girlVoice.classList.add('active');
                boyVoice.classList.remove('active');
            }
            localStorage.setItem('selected_voice', voice);
            console.log('Voice selected:', voice);
        }

        if (boyVoice && girlVoice) {
            // Load saved preference
            const savedVoice = localStorage.getItem('selected_voice') || 'boy';
            selectVoice(savedVoice);

            boyVoice.addEventListener('click', () => selectVoice('boy'));
            girlVoice.addEventListener('click', () => selectVoice('girl'));
        }
    }

    // ============================================
    // BURGER MENU COMPONENT
    // ============================================
    const burgerBtn = document.getElementById('burgerBtn');
    const burgerMenu = document.getElementById('burgerMenu');

    if (burgerBtn && burgerMenu) {
        // Burger Dropdown Toggle
        burgerBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            burgerMenu.classList.toggle('active');
            
            // Close settings menu if open
            if (settingsMenu) {
                settingsMenu.classList.remove('active');
            }
        });

        // Close burger menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!burgerMenu.contains(e.target) && !burgerBtn.contains(e.target)) {
                burgerMenu.classList.remove('active');
            }
        });

        // Close burger menu on Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                burgerMenu.classList.remove('active');
            }
        });
    }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

// Get current user
function getCurrentUser() {
    const userStr = localStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
}

// Check if user is authenticated
function requireAuth() {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getCurrentUser,
        requireAuth
    };
}