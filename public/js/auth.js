<<<<<<< Updated upstream:public/js/auth.js
// auth.js — Capacitor/Android version
// REMOVED: const { ipcRenderer } = require('electron')
// REPLACED: All ipcRenderer.invoke calls → direct db calls

import { db } from './db/db-interface.js';
=======
// auth.js - Authentication logic for VocabVenture
// Uses bridge.js instead of ipcRenderer — works on Electron AND Android.

/**
 * waitForDB()
 * -----------
 * Returns a Promise that resolves once window.db is ready.
 * - If window.db already exists (Electron fast path), resolves immediately.
 * - Otherwise waits for the 'db:ready' event fired by app-init.js.
 * - Rejects after 10 seconds so the user gets a meaningful error.
 */
function waitForDB() {
    return new Promise((resolve, reject) => {
        if (window.db) return resolve();

        const timeout = setTimeout(() => {
            reject(new Error('Database took too long to initialise. Please restart the app.'));
        }, 10000);

        window.addEventListener('db:ready', () => {
            clearTimeout(timeout);
            resolve();
        }, { once: true });
    });
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
>>>>>>> Stashed changes:app/js/auth.js

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

<<<<<<< Updated upstream:public/js/auth.js
    const name = document.getElementById('loginName').value.trim();
=======
    const name      = document.getElementById('loginName').value.trim();
>>>>>>> Stashed changes:app/js/auth.js
    const birthdate = document.getElementById('loginBirthdate').value;

    if (!name || !birthdate) {
        showMessage('Please fill in all fields', 'error');
        return;
    }

    try {
<<<<<<< Updated upstream:public/js/auth.js
        const result = await db.login(name, birthdate);
=======
        await waitForDB();
        const result = await bridge.invoke('auth:login', { name, birthdate });
>>>>>>> Stashed changes:app/js/auth.js

        if (result.success) {
            showMessage('Login successful! Welcome back!', 'success');
            localStorage.setItem('currentUser', JSON.stringify(result.user));
<<<<<<< Updated upstream:public/js/auth.js
=======

>>>>>>> Stashed changes:app/js/auth.js
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

// ── REGISTER ──────────────────────────────────────────────────────────────────

document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

<<<<<<< Updated upstream:public/js/auth.js
    const name = document.getElementById('registerName').value.trim();
=======
    const name      = document.getElementById('registerName').value.trim();
>>>>>>> Stashed changes:app/js/auth.js
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
<<<<<<< Updated upstream:public/js/auth.js
        const result = await db.register(name, birthdate);
=======
        await waitForDB();
        const result = await bridge.invoke('auth:register', { name, birthdate });
>>>>>>> Stashed changes:app/js/auth.js

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

<<<<<<< Updated upstream:public/js/auth.js
=======
// ── HELPERS ───────────────────────────────────────────────────────────────────

>>>>>>> Stashed changes:app/js/auth.js
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
<<<<<<< Updated upstream:public/js/auth.js
=======

>>>>>>> Stashed changes:app/js/auth.js
    if (currentUser && (currentPage.includes('login.html') || currentPage.includes('register.html'))) {
        window.location.href = '../dashboard/welcome-auth.html';
    }
}

<<<<<<< Updated upstream:public/js/auth.js
checkAuth();
=======
checkAuth();
>>>>>>> Stashed changes:app/js/auth.js
