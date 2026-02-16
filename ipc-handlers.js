// IPC Handlers for VocabVenture - Add these to your index.js

const { ipcMain } = require('electron');
const VocabVentureDB = require('./app/js/database');

// Initialize database
const db = new VocabVentureDB();

// ============================================
// AUTHENTICATION HANDLERS
// ============================================

ipcMain.handle('auth:login', async (event, { name, birthdate }) => {
    try {
        return db.login(name, birthdate);
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: 'An error occurred during login' };
    }
});

ipcMain.handle('auth:register', async (event, { name, birthdate }) => {
    try {
        return db.register(name, birthdate);
    } catch (error) {
        console.error('Registration error:', error);
        return { success: false, message: 'An error occurred during registration' };
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

// Save last viewed segment
ipcMain.handle('progress:saveLastViewed', async (event, { userId, storyId, segmentId }) => {
    try {
        return db.saveLastViewedSegment(userId, storyId, segmentId);
    } catch (error) {
        console.error('Save last viewed segment error:', error);
        throw error;
    }
});

// Get last viewed segment
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

// ============================================
// CLEANUP ON APP QUIT
// ============================================

process.on('exit', () => {
    db.close();
    console.log('Database connection closed');
});

// Handle graceful shutdown
app.on('will-quit', () => {
    db.close();
    console.log('Database connection closed on app quit');
});