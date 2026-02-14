// components.js - UNIVERSAL FIX (No loops)

console.log('🔧 Components.js loaded');

// Prevent multiple initializations
let isInitialized = false;
let initTimeout = null;

// =============================================================================
// INITIALIZATION - Single controlled entry point
// =============================================================================

function scheduleInit() {
    // Cancel any pending initialization
    if (initTimeout) {
        clearTimeout(initTimeout);
    }
    
    // Schedule initialization (debounced)
    initTimeout = setTimeout(init, 150);
}

// Run on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleInit);
} else {
    scheduleInit();
}

// Expose as global function
window.initializeComponents = function() {
    isInitialized = false; // Allow re-initialization when called manually
    scheduleInit();
};

// =============================================================================
// MAIN INITIALIZATION
// =============================================================================

function init() {
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsMenu = document.getElementById('settingsMenu');
    const burgerBtn = document.getElementById('burgerBtn');
    const burgerMenu = document.getElementById('burgerMenu');
    
    // Skip if no components found
    if (!settingsBtn && !burgerBtn) {
        console.log('⏳ Components not found, waiting...');
        return;
    }
    
    // Skip if already initialized (prevent loops)
    if (isInitialized) {
        console.log('✋ Already initialized, skipping');
        return;
    }
    
    console.log('🚀 Initializing components...');
    console.log('Settings button:', settingsBtn ? '✅' : '❌');
    console.log('Settings menu:', settingsMenu ? '✅' : '❌');
    console.log('Burger button:', burgerBtn ? '✅' : '❌');
    console.log('Burger menu:', burgerMenu ? '✅' : '❌');
    
    // Initialize settings
    if (settingsBtn && settingsMenu) {
        initializeSettings(settingsBtn, settingsMenu, burgerMenu);
    }
    
    // Initialize burger
    if (burgerBtn && burgerMenu) {
        initializeBurger(burgerBtn, burgerMenu, settingsMenu);
    }
    
    // Setup global handlers (only once)
    if (!window._componentsGlobalHandlersSet) {
        setupGlobalHandlers();
        window._componentsGlobalHandlersSet = true;
    }
    
    // Mark as initialized
    isInitialized = true;
    console.log('✅ Components initialized');
}

// =============================================================================
// SETTINGS INITIALIZATION
// =============================================================================

function initializeSettings(btn, menu, burgerMenu) {
    console.log('⚙️ Initializing settings...');
    
    // Remove existing listeners by cloning
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    // Click handler
    newBtn.addEventListener('click', function(e) {
        console.log('⚙️ Settings clicked');
        e.preventDefault();
        e.stopPropagation();
        
        // Toggle menu
        menu.classList.toggle('active');
        
        // Close burger
        if (burgerMenu) {
            burgerMenu.classList.remove('active');
        }
    });
    
    // Initialize controls
    initializeSettingsControls();
}

// =============================================================================
// SETTINGS CONTROLS
// =============================================================================

function initializeSettingsControls() {
    // Sound Toggle
    const soundToggle = document.getElementById('soundToggle');
    if (soundToggle && !soundToggle._initialized) {
        const saved = localStorage.getItem('sound_enabled');
        if (saved !== null) {
            soundToggle.checked = saved === 'true';
        }
        soundToggle.addEventListener('change', function() {
            localStorage.setItem('sound_enabled', this.checked);
            console.log('🔊 Sound:', this.checked ? 'ON' : 'OFF');
        });
        soundToggle._initialized = true;
    }
    
    // Volume Slider
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeValue = document.getElementById('volumeValue');
    if (volumeSlider && volumeValue && !volumeSlider._initialized) {
        const saved = localStorage.getItem('volume') || '70';
        volumeSlider.value = saved;
        volumeValue.textContent = saved;
        
        volumeSlider.addEventListener('input', function() {
            volumeValue.textContent = this.value;
            localStorage.setItem('volume', this.value);
        });
        volumeSlider._initialized = true;
    }
    
    // Voice Selection
    const boyVoice = document.getElementById('boyVoice');
    const girlVoice = document.getElementById('girlVoice');
    if (boyVoice && girlVoice && !boyVoice._initialized) {
        const saved = localStorage.getItem('selected_voice') || 'boy';
        
        function selectVoice(voice) {
            if (voice === 'boy') {
                boyVoice.classList.add('active');
                girlVoice.classList.remove('active');
            } else {
                girlVoice.classList.add('active');
                boyVoice.classList.remove('active');
            }
            localStorage.setItem('selected_voice', voice);
        }
        
        selectVoice(saved);
        boyVoice.addEventListener('click', () => selectVoice('boy'));
        girlVoice.addEventListener('click', () => selectVoice('girl'));
        boyVoice._initialized = true;
        girlVoice._initialized = true;
    }
}

// =============================================================================
// BURGER INITIALIZATION
// =============================================================================

function initializeBurger(btn, menu, settingsMenu) {
    console.log('🍔 Initializing burger...');
    
    // Remove existing listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    // Click handler
    newBtn.addEventListener('click', function(e) {
        console.log('🍔 Burger clicked');
        e.preventDefault();
        e.stopPropagation();
        
        // Toggle menu
        menu.classList.toggle('active');
        
        // Close settings
        if (settingsMenu) {
            settingsMenu.classList.remove('active');
        }
    });
}

// =============================================================================
// GLOBAL HANDLERS (Close on outside click, ESC)
// =============================================================================

function setupGlobalHandlers() {
    // Outside click
    document.addEventListener('click', function(e) {
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsMenu = document.getElementById('settingsMenu');
        const burgerBtn = document.getElementById('burgerBtn');
        const burgerMenu = document.getElementById('burgerMenu');
        
        // Close settings
        if (settingsMenu && settingsBtn) {
            if (!settingsMenu.contains(e.target) && !settingsBtn.contains(e.target)) {
                settingsMenu.classList.remove('active');
            }
        }
        
        // Close burger
        if (burgerMenu && burgerBtn) {
            if (!burgerMenu.contains(e.target) && !burgerBtn.contains(e.target)) {
                burgerMenu.classList.remove('active');
            }
        }
    });
    
    // ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const settingsMenu = document.getElementById('settingsMenu');
            const burgerMenu = document.getElementById('burgerMenu');
            
            if (settingsMenu) settingsMenu.classList.remove('active');
            if (burgerMenu) burgerMenu.classList.remove('active');
        }
    });
}

// =============================================================================
// LOGOUT FUNCTION
// =============================================================================

window.handleLogout = function() {
    console.log('🚪 Logging out...');
    localStorage.removeItem('currentUser');
    
    const path = window.location.pathname;
    if (path.includes('/pages/')) {
        window.location.href = '../dashboard/welcome.html';
    } else {
        window.location.href = 'pages/dashboard/welcome.html';
    }
};

// =============================================================================
// HELPER FUNCTIONSbu
// =============================================================================

function getCurrentUser() {
    const userStr = localStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
}

function requireAuth() {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = '../auth/login.html';
        return false;
    }
    return true;
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getCurrentUser, requireAuth };
}

// =============================================================================
// MUTATION OBSERVER (Controlled - only re-init if needed)
// =============================================================================

let observerTimeout = null;

const observer = new MutationObserver(function(mutations) {
    // Clear pending timeout
    if (observerTimeout) {
        clearTimeout(observerTimeout);
    }
    
    // Check if components were added
    let hasComponents = false;
    mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) {
                    if (node.id === 'settingsBtn' || 
                        node.id === 'burgerBtn' ||
                        node.querySelector && (
                            node.querySelector('#settingsBtn') ||
                            node.querySelector('#burgerBtn')
                        )) {
                        hasComponents = true;
                    }
                }
            });
        }
    });
    
    // Only re-init if components found and not already initialized
    if (hasComponents && !isInitialized) {
        console.log('🔄 Components detected, initializing...');
        observerTimeout = setTimeout(function() {
            scheduleInit();
        }, 200);
    }
});

// Start observing
if (document.body) {
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

console.log('✅ Components.js ready');