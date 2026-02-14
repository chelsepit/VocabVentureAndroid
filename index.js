const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const VocabVentureDB = require('./app/js/database');

// Initialize database
const db = new VocabVentureDB();

let mainWindow;

function createWindow() {
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
    
    // Load welcome page initially
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

// ============================================
// AUTHENTICATION HANDLERS
// ============================================

ipcMain.handle('auth:login', async (event, { name, birthdate }) => {
    try {
        console.log('Login attempt:', name);
        return db.login(name, birthdate);
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: 'An error occurred during login' };
    }
});

ipcMain.handle('auth:register', async (event, { name, birthdate }) => {
    try {
        console.log('Registration attempt:', name);
        return db.register(name, birthdate);
    } catch (error) {
        console.error('Registration error:', error);
        return { success: false, message: 'An error occurred during registration' };
    }
});

ipcMain.handle('user:get', async (event, userId) => {
    try {
        return db.getUser(userId);
    } catch (error) {
        console.error('Get user error:', error);
        return null;
    }
});

// ============================================
// PROGRESS HANDLERS
// ============================================

ipcMain.handle('progress:save', async (event, { userId, storyId, segmentId }) => {
    try {
        return db.saveProgress(userId, storyId, segmentId);
    } catch (error) {
        console.error('Save progress error:', error);
        throw error;
    }
});

ipcMain.handle('progress:get', async (event, { userId, storyId }) => {
    try {
        return db.getProgress(userId, storyId);
    } catch (error) {
        console.error('Get progress error:', error);
        return [];
    }
});

ipcMain.handle('progress:getAll', async (event, userId) => {
    try {
        return db.getAllProgress(userId);
    } catch (error) {
        console.error('Get all progress error:', error);
        return [];
    }
});

ipcMain.handle('progress:getOverall', async (event, userId) => {
    try {
        return db.getOverallProgress(userId);
    } catch (error) {
        console.error('Get overall progress error:', error);
        return { completed: 0, total: 42, percentage: 0 };
    }
});

ipcMain.handle('progress:saveLastViewed', async (event, { userId, storyId, segmentId }) => {
    try {
        return db.saveLastViewedSegment(userId, storyId, segmentId);
    } catch (error) {
        console.error('Save last viewed segment error:', error);
        throw error;
    }
});

ipcMain.handle('progress:getLastViewed', async (event, { userId, storyId }) => {
    try {
        return db.getLastViewedSegment(userId, storyId);
    } catch (error) {
        console.error('Get last viewed segment error:', error);
        return 0;
    }
});

// ============================================
// STORY COMPLETION STATUS HANDLER
// ============================================

ipcMain.handle('story:getCompletionStatus', async (event, { userId, storyId, totalSegments }) => {
    try {
        return db.getStoryCompletionStatus(userId, storyId, totalSegments);
    } catch (error) {
        console.error('Get completion status error:', error);
        return {
            storyCompleted: false,
            completedSegments: 0,
            totalSegments: totalSegments,
            quiz1Completed: false,
            quiz2Completed: false
        };
    }
});

// ============================================
// QUIZ HANDLERS
// ============================================

ipcMain.handle('quiz:save', async (event, { userId, storyId, quizNumber, score, totalQuestions }) => {
    try {
        return db.saveQuizResult(userId, storyId, quizNumber, score, totalQuestions);
    } catch (error) {
        console.error('Save quiz result error:', error);
        throw error;
    }
});

ipcMain.handle('quiz:getResults', async (event, { userId, storyId }) => {
    try {
        return db.getQuizResults(userId, storyId);
    } catch (error) {
        console.error('Get quiz results error:', error);
        return [];
    }
});

ipcMain.handle('quiz:getBestScore', async (event, { userId, storyId, quizNumber }) => {
    try {
        return db.getBestQuizScore(userId, storyId, quizNumber);
    } catch (error) {
        console.error('Get best score error:', error);
        return null;
    }
});

// ============================================
// BADGE HANDLERS
// ============================================

ipcMain.handle('badge:award', async (event, { userId, storyId, badgeType, badgeCategory }) => {
    try {
        return db.awardBadge(userId, storyId, badgeType, badgeCategory);
    } catch (error) {
        console.error('Error awarding badge:', error);
        throw error;
    }
});

ipcMain.handle('badge:getAll', async (event, userId) => {
    try {
        return db.getAllUserBadges(userId);
    } catch (error) {
        console.error('Get all badges error:', error);
        return [];
    }
});

ipcMain.handle('badge:getAllOrdered', async (event, userId) => {
    try {
        return db.getAllUserBadgesOrdered(userId);
    } catch (error) {
        console.error('Get ordered badges error:', error);
        return [];
    }
});

ipcMain.handle('badge:getStats', async (event, userId) => {
    try {
        return db.getBadgeStats(userId);
    } catch (error) {
        console.error('Get badge stats error:', error);
        return { gold: 0, silver: 0, bronze: 0, total: 0 };
    }
});

ipcMain.handle('badge:getStory', async (event, { userId, storyId }) => {
    try {
        return db.getUserBadges(userId, storyId);
    } catch (error) {
        console.error('Get story badges error:', error);
        return [];
    }
});

ipcMain.handle('badge:has', async (event, { userId, storyId, badgeCategory }) => {
    try {
        return db.hasBadge(userId, storyId, badgeCategory);
    } catch (error) {
        console.error('Check badge error:', error);
        return false;
    }
});

// ============================================
// USER STATS HANDLERS
// ============================================

ipcMain.handle('user:getStats', async (event, userId) => {
    try {
        return db.getUserStats(userId);
    } catch (error) {
        console.error('Get user stats error:', error);
        return null;
    }
});

ipcMain.handle('stats:get', async (event, userId) => {
    try {
        return db.getUserStats(userId);
    } catch (error) {
        console.error('Get stats error:', error);
        return null;
    }
});

// ============================================
// CLEANUP HANDLERS
// ============================================

process.on('exit', () => {
    if (db) {
        db.close();
        console.log('Database connection closed on exit');
    }
});

app.on('will-quit', () => {
    if (db) {
        db.close();
        console.log('Database connection closed on app quit');
    }
});

// Handle app errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
});