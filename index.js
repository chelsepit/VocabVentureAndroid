const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const VocabVentureDB = require('./app/js/database');

let db;
let mainWindow;


app.commandLine.appendSwitch('--disable-http-cache');
app.commandLine.appendSwitch('--disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('--disable-application-cache');

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        autoHideMenuBar: true, 
        icon: path.join(__dirname, 'app/assets/images/app-logo/vocabventure_logo.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // // Open DevTools (remove this in production)
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

app.whenReady().then(async () => {
    db = new VocabVentureDB();

    // ⚡ Nuclear cache clear — wipes ALL cached assets before window loads
    // This ensures replaced audio/image files are always served fresh from disk
    const { session } = require('electron');
    await session.defaultSession.clearCache();
    await session.defaultSession.clearStorageData({
        storages: ['cachestorage', 'shadercache', 'serviceworkers']
    });
    console.log('✅ All caches cleared');

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

// ⭐ NEW: Mark individual segment as completed
ipcMain.handle('progress:markSegmentComplete', async (event, data) => {
    try {
        const { userId, storyId, segmentId } = data;
        
        // Save to progress table
        const result = db.saveProgress(userId, storyId, segmentId);
        
        console.log(`✅ Segment marked complete: User ${userId}, Story ${storyId}, Segment ${segmentId}`);
        
        return { success: true, result };
    } catch (error) {
        console.error('Error marking segment complete:', error);
        return { success: false, error: error.message };
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

ipcMain.handle('progress:saveLastViewed', async (event, data) => {
    try {
        const { userId, storyId, segmentId } = data;
        
        // Update last_viewed_segment in progress table
        const stmt = db.db.prepare(`
            INSERT INTO progress (user_id, story_id, segment_id, last_viewed_segment, completed)
            VALUES (?, ?, 1, ?, 0)
            ON CONFLICT(user_id, story_id, segment_id) 
            DO UPDATE SET last_viewed_segment = ?
        `);
        
        const result = stmt.run(userId, storyId, segmentId, segmentId);
        
        return { success: true };
    } catch (error) {
        console.error('Error saving last viewed:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('progress:getLastViewed', async (event, data) => {
    try {
        const { userId, storyId } = data;
        
        const stmt = db.db.prepare(`
            SELECT last_viewed_segment
            FROM progress
            WHERE user_id = ? AND story_id = ?
            ORDER BY id DESC
            LIMIT 1
        `);
        
        const result = stmt.get(userId, storyId);
        
        return result ? result.last_viewed_segment : 0;
    } catch (error) {
        console.error('Error getting last viewed:', error);
        return 0;
    }
});


// ============================================
// STORY COMPLETION STATUS HANDLER
// ============================================

ipcMain.handle('story:getCompletionStatus', async (event, data) => {
    try {
        const { userId, storyId, totalSegments } = data;
        
        // Get completed segments count
        const segmentStmt = db.db.prepare(`
            SELECT COUNT(*) as count
            FROM progress
            WHERE user_id = ? AND story_id = ? AND completed = 1
        `);
        
        const segmentResult = segmentStmt.get(userId, storyId);
        const completedSegments = segmentResult ? segmentResult.count : 0;
        
        // Check if story is fully complete
        const storyCompleted = completedSegments >= totalSegments;
        
        // Check quiz completion — only a perfect score (5/5) unlocks progression
        const quizStmt = db.db.prepare(`
            SELECT quiz_number, MAX(score) as best_score, total_questions
            FROM quiz_results
            WHERE user_id = ? AND story_id = ?
            GROUP BY quiz_number
        `);

        const quizResults = quizStmt.all(userId, storyId);

        const quiz1Result = quizResults.find(q => q.quiz_number === 1);
        const quiz2Result = quizResults.find(q => q.quiz_number === 2);

        // Only perfect score unlocks next stage
        const quiz1Completed = quiz1Result ? quiz1Result.best_score === quiz1Result.total_questions : false;
        const quiz2Completed = quiz2Result ? quiz2Result.best_score === quiz2Result.total_questions : false;
        
        // Get last accessed time
        const lastAccessStmt = db.db.prepare(`
            SELECT MAX(completed_at) as lastAccessed
            FROM progress
            WHERE user_id = ? AND story_id = ?
        `);
        
        const lastAccessResult = lastAccessStmt.get(userId, storyId);
        const lastAccessed = lastAccessResult ? lastAccessResult.lastAccessed : null;
        
        return {
            completedSegments: completedSegments,
            totalSegments: totalSegments,
            storyCompleted: storyCompleted,
            quiz1Completed: quiz1Completed,
            quiz2Completed: quiz2Completed,
            lastAccessed: lastAccessed
        };
    } catch (error) {
        console.error('Error getting completion status:', error);
        return {
            completedSegments: 0,
            totalSegments: totalSegments,
            storyCompleted: false,
            quiz1Completed: false,
            quiz2Completed: false,
            lastAccessed: null
        };
    }
});

// ============================================
// QUIZ HANDLERS
// ============================================

ipcMain.handle('quiz:save', async (event, { userId, storyId, quizNumber, score, totalQuestions }) => {
    try {
        // Check if a result already exists for this user/story/quiz
        const existing = db.db.prepare(`
            SELECT id, score FROM quiz_results
            WHERE user_id = ? AND story_id = ? AND quiz_number = ?
            ORDER BY score DESC
            LIMIT 1
        `).get(userId, storyId, quizNumber);

        // Badge: quiz 1 perfect = silver, quiz 2 perfect = gold, otherwise bronze
        const isPerfect = score === totalQuestions;
        let badgeType;
        if (isPerfect) {
            badgeType = quizNumber === 1 ? 'silver' : 'gold';
        } else {
            badgeType = 'bronze';
        }

        if (!existing) {
            // First attempt — always save
            const stmt = db.db.prepare(`
                INSERT INTO quiz_results (user_id, story_id, quiz_number, score, total_questions, badge_type)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            stmt.run(userId, storyId, quizNumber, score, totalQuestions, badgeType);
            console.log(`💾 Quiz ${quizNumber} first attempt saved: ${score}/${totalQuestions} (${badgeType})`);
            return { success: true };
        } else if (score > existing.score) {
            // Retake with better score — update existing row
            db.db.prepare(`
                UPDATE quiz_results
                SET score = ?, badge_type = ?, completed_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND story_id = ? AND quiz_number = ?
            `).run(score, badgeType, userId, storyId, quizNumber);
            console.log(`📈 Quiz ${quizNumber} score improved: ${existing.score} → ${score} (${badgeType})`);
            return { success: true };
        } else {
            // Retake with same or worse score — don't overwrite
            console.log(`📊 Quiz ${quizNumber} retake score (${score}) not better than best (${existing.score}), skipping`);
            return { success: true };
        }
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

ipcMain.handle('badge:award', async (event, { userId, storyId, badgeType }) => {
    try {
        // One badge per story — awardBadge handles upgrade logic internally
        return db.awardBadge(userId, storyId, badgeType);
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

// badge:upgrade now delegates to awardBadge (same upgrade logic)
ipcMain.handle('badge:upgrade', async (event, { userId, storyId, newBadgeType }) => {
    try {
        const result = db.awardBadge(userId, storyId, newBadgeType);
        console.log(`🎖️ Badge upgrade attempted: User ${userId}, Story ${storyId} → ${newBadgeType.toUpperCase()}`);
        return { success: true };
    } catch (error) {
        console.error('Error upgrading badge:', error);
        return { success: false, error: error.message };
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