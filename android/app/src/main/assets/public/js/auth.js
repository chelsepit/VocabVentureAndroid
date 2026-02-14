// auth.js - Authentication logic for VocabVenture

const { ipcRenderer } = require('electron');

// Handle login form submission
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('loginName').value.trim();
    const birthdate = document.getElementById('loginBirthdate').value;
    
    if (!name || !birthdate) {
        showMessage('Please fill in all fields', 'error');
        return;
    }
    
    try {
        // Send login request to main process
        const result = await ipcRenderer.invoke('auth:login', { name, birthdate });
        
        if (result.success) {
            showMessage('Login successful! Welcome back!', 'success');
            
            // Store user data in localStorage
            localStorage.setItem('currentUser', JSON.stringify(result.user));
            
            // Redirect to authenticated welcome page after short delay
            setTimeout(() => {
                if (window.navigateTo) {
                    window.navigateTo('welcome-auth');
                } else {
                    window.location.href = '../dashboard/welcome-auth.html';
                }
            }, 1000);
        } else {
            showMessage(result.message || 'Login failed. Please check your credentials.', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('An error occurred. Please try again.', 'error');
    }
});

// Handle register form submission
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value.trim();
    const birthdate = document.getElementById('registerBirthdate').value;
    
    if (!name || !birthdate) {
        showMessage('Please fill in all fields', 'error');
        return;
    }
    
    // Validate name format (at least first and last name)
    const nameParts = name.split(' ').filter(part => part.length > 0);
    if (nameParts.length < 2) {
        showMessage('Please enter your first and last name', 'error');
        return;
    }
    
    try {
        // Send registration request to main process
        const result = await ipcRenderer.invoke('auth:register', { name, birthdate });
        
        if (result.success) {
            showMessage('Account created successfully! Redirecting to login...', 'success');
            
            // Redirect to login after short delay
            setTimeout(() => {
                if (window.navigateTo) {
                    window.navigateTo('login');
                } else {
                    window.location.href = 'login.html';
                }
            }, 2000);
        } else {
            showMessage(result.message || 'Registration failed. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showMessage('An error occurred. Please try again.', 'error');
    }
});

// Show error/success messages
function showMessage(message, type = 'error') {
    const messageContainer = document.getElementById('messageContainer');
    
    if (!messageContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
    messageDiv.textContent = message;
    
    messageContainer.innerHTML = '';
    messageContainer.appendChild(messageDiv);
    
    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }
}

// Check if user is already logged in
function checkAuth() {
    const currentUser = localStorage.getItem('currentUser');
    const currentPage = window.location.pathname;
    
    // If already logged in and on login/register page, redirect to dashboard
    if (currentUser && (currentPage.includes('login.html') || currentPage.includes('register.html'))) {
        window.location.href = '../../index.html';
    }
}

// Run auth check on page load
checkAuth();