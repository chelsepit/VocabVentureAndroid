// auth.js — Capacitor/Android version
// REMOVED: const { ipcRenderer } = require('electron')
// REPLACED: All ipcRenderer.invoke calls → direct db calls

import { db } from './db/db-interface.js';

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
        const result = await db.login(name, birthdate);

        if (result.success) {
            showMessage('Login successful! Welcome back!', 'success');
            localStorage.setItem('currentUser', JSON.stringify(result.user));
            setTimeout(() => {
                window.location.href = '../dashboard/welcome-auth.html';
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

    const nameParts = name.split(' ').filter(part => part.length > 0);
    if (nameParts.length < 2) {
        showMessage('Please enter your first and last name', 'error');
        return;
    }

    try {
        const result = await db.register(name, birthdate);

        if (result.success) {
            showMessage('Account created successfully! Redirecting to login...', 'success');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            showMessage(result.message || 'Registration failed. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showMessage('An error occurred. Please try again.', 'error');
    }
});

function showMessage(message, type = 'error') {
    const messageContainer = document.getElementById('messageContainer');
    if (!messageContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
    messageDiv.textContent = message;

    messageContainer.innerHTML = '';
    messageContainer.appendChild(messageDiv);

    if (type === 'success') {
        setTimeout(() => messageDiv.remove(), 3000);
    }
}

function checkAuth() {
    const currentUser = localStorage.getItem('currentUser');
    const currentPage = window.location.pathname;
    if (currentUser && (currentPage.includes('login.html') || currentPage.includes('register.html'))) {
        window.location.href = '../dashboard/welcome-auth.html';
    }
}

checkAuth();
