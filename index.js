const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const VocabVentureDB = require('./app/js/database');

let mainWindow;
let db;

function createWindow() {
    // Initialize database
    db = new VocabVentureDB();
    
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Open DevTools (remove this in production)
    mainWindow.webContents.openDevTools();
    
    // Load welcome page initially (or login.html if you prefer)
    mainWindow.loadFile('app/pages/dashboard/welcome.html');

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Auto-logout: Clear user session when window is closing
    mainWindow.on('close', () => {
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.executeJavaScript(`
                localStorage.removeItem('currentUser');
            `).catch(() => {
                // Ignore errors if window is already destroyed
            });
        }
    });
}

// ============================================
// AUTHENTICATION IPC HANDLERS
// ============================================

// Handle login
ipcMain.handle('auth:login', async (event, { name, birthdate }) => {
    console.log('Login attempt:', name, birthdate);
    const result = db.login(name, birthdate);
    return result;
});

// Handle registration
ipcMain.handle('auth:register', async (event, { name, birthdate }) => {
    console.log('Registration attempt:', name, birthdate);
    const result = db.register(name, birthdate);
    return result;
});

// Get user by ID
ipcMain.handle('user:get', async (event, userId) => {
    return db.getUser(userId);
});

// ============================================
// PROGRESS IPC HANDLERS
// ============================================

// Save progress
ipcMain.handle('progress:save', async (event, { userId, storyId, segmentId }) => {
    try {
        db.saveProgress(userId, storyId, segmentId);
        return { success: true };
    } catch (error) {
        console.error('Error saving progress:', error);
        return { success: false, message: error.message };
    }
});

// Get progress for a story
ipcMain.handle('progress:get', async (event, { userId, storyId }) => {
    return db.getProgress(userId, storyId);
});

// Get all progress
ipcMain.handle('progress:getAll', async (event, userId) => {
    return db.getAllProgress(userId);
});

// Get overall progress
ipcMain.handle('progress:getOverall', async (event, userId) => {
    return db.getOverallProgress(userId);
});

// ============================================
// QUIZ IPC HANDLERS
// ============================================

// Save quiz result
ipcMain.handle('quiz:save', async (event, { userId, storyId, score, totalQuestions }) => {
    try {
        db.saveQuizResult(userId, storyId, score, totalQuestions);
        
        // Check and award badges based on quiz performance
        checkAndAwardQuizBadges(userId, storyId, score, totalQuestions);
        
        return { success: true };
    } catch (error) {
        console.error('Error saving quiz result:', error);
        return { success: false, message: error.message };
    }
});

// Get quiz results
ipcMain.handle('quiz:getResults', async (event, { userId, storyId }) => {
    return db.getQuizResults(userId, storyId);
});

// ============================================
// BADGE IPC HANDLERS
// ============================================

// Award badge
ipcMain.handle('badge:award', async (event, { userId, badgeId }) => {
    try {
        db.awardBadge(userId, badgeId);
        return { success: true };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

// Get user badges
ipcMain.handle('badge:getAll', async (event, userId) => {
    return db.getUserBadges(userId);
});

// Check if user has badge
ipcMain.handle('badge:has', async (event, { userId, badgeId }) => {
    return db.hasBadge(userId, badgeId);
});

// ============================================
// STATS IPC HANDLERS
// ============================================

// Get user stats
ipcMain.handle('stats:get', async (event, userId) => {
    return db.getUserStats(userId);
});

// ============================================
// BADGE AWARD LOGIC
// ============================================

function checkAndAwardQuizBadges(userId, storyId, score, totalQuestions) {
    const percentage = (score / totalQuestions) * 100;
    
    // Perfect score badge
    if (percentage === 100) {
        db.awardBadge(userId, 'perfect-score');
    }
    
    // First quiz completed
    const quizResults = db.getQuizResults(userId);
    if (quizResults.length === 1) {
        db.awardBadge(userId, 'first-quiz');
    }
    
    // Quiz master (completed all 3 story quizzes)
    const uniqueStories = [...new Set(quizResults.map(q => q.story_id))];
    if (uniqueStories.length === 3) {
        db.awardBadge(userId, 'quiz-master');
    }
    
    // High achiever (80% or higher on any quiz)
    if (percentage >= 80) {
        db.awardBadge(userId, 'high-achiever');
    }
}

function checkAndAwardProgressBadges(userId) {
    const progress = db.getOverallProgress(userId);
    
    // First story completed (14 segments)
    if (progress.completed >= 14 && !db.hasBadge(userId, 'first-story')) {
        db.awardBadge(userId, 'first-story');
    }
    
    // Halfway there (21 segments)
    if (progress.completed >= 21 && !db.hasBadge(userId, 'halfway')) {
        db.awardBadge(userId, 'halfway');
    }
    
    // All stories completed (42 segments)
    if (progress.completed >= 42 && !db.hasBadge(userId, 'all-stories')) {
        db.awardBadge(userId, 'all-stories');
    }
}

// ============================================
// APP LIFECYCLE
// ============================================

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (db) {
        db.close();
        console.log('Database closed');
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Handle app errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
});