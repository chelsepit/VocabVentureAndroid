/**
 * index.js — Electron Main Process (Updated)
 * -------------------------------------------
 * Uses the new adapter-based VocabVentureDB.
 * The IPC handlers are much leaner now — all SQL logic lives in db-core.js.
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const createElectronAdapter = require('./app/db/db-electron-adapter');
const VocabVentureDB        = require('./app/db/db-core');

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

    mainWindow.loadFile('app/pages/dashboard/welcome.html');

    mainWindow.on('closed', () => { mainWindow = null; });

    mainWindow.on('close', () => {
        if (mainWindow?.webContents) {
            mainWindow.webContents
                .executeJavaScript(`localStorage.removeItem('currentUser');`)
                .catch(() => {});
        }
    });
}

// ============================================================
// APP LIFECYCLE
// ============================================================

app.whenReady().then(async () => {
    try {
        const adapter = createElectronAdapter();
        db = new VocabVentureDB(adapter);
        await db.initialize();
        console.log('✅ Database ready');
    } catch (err) {
        console.error('❌ Database initialization failed:', err);
    }

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', async () => {
    if (db) {
        await db.close();
        console.log('Database closed');
    }
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', async () => {
    if (db) {
        await db.close();
        console.log('Database closed on quit');
    }
});

process.on('uncaughtException',  err => console.error('Uncaught exception:', err));
process.on('unhandledRejection', err => console.error('Unhandled rejection:', err));

// ============================================================
// IPC HANDLERS  (all delegate to db-core.js via db.*)
// ============================================================

// Helper: wraps a db call, returns result or a safe default on error
function handle(channel, fn, defaultValue = null) {
    ipcMain.handle(channel, async (event, payload) => {
        try {
            return await fn(payload);
        } catch (err) {
            console.error(`[${channel}] error:`, err);
            return defaultValue;
        }
    });
}
ipcMain.handle('app:getUserDataPath', () => {
    return app.getPath('userData');
});

// ── System ───────────────────────────────────────────────────
handle('system:getUserDataPath', () => app.getPath('userData'));


// ── Auth ─────────────────────────────────────────────────────
handle('auth:login',
    p => db.login(p.name, p.birthdate),
    { success: false, message: 'Login error' }
);

handle('auth:register',
    p => db.register(p.name, p.birthdate),
    { success: false, message: 'Register error' }
);

handle('user:get',
    p => db.getUser(p)
);

// ── Progress ─────────────────────────────────────────────────
handle('progress:save',
    p => db.saveProgress(p.userId, p.storyId, p.segmentId),
    null
);

handle('progress:get',
    p => db.getProgress(p.userId, p.storyId),
    []
);

handle('progress:getAll',
    p => db.getAllProgress(p),
    []
);

handle('progress:getOverall',
    p => db.getOverallProgress(p),
    { completed: 0, total: 42, percentage: 0 }
);

handle('progress:markSegmentComplete', async p => {
    const result = await db.saveProgress(p.userId, p.storyId, p.segmentId);
    return { success: true, result };
});

handle('progress:saveLastViewed', async p => {
    await db.saveLastViewedSegment(p.userId, p.storyId, p.segmentId);
    return { success: true };
});

handle('progress:getLastViewed',
    p => db.getLastViewedSegment(p.userId, p.storyId),
    0
);

// ── Story ────────────────────────────────────────────────────
handle('story:getCompletionStatus',
    p => db.getStoryCompletionStatus(
        p.userId,
        p.storyId,
        p.totalSegments
    ),
    {
        completedSegments: 0,
        totalSegments: 0,
        storyCompleted: false,
        quiz1Completed: false,
        quiz2Completed: false,
        lastAccessed: null
    }
);

// ── Quiz ─────────────────────────────────────────────────────
handle('quiz:save',
    p => db.saveQuizResult(
        p.userId,
        p.storyId,
        p.quizNumber,
        p.score,
        p.totalQuestions
    ),
    { success: false }
);

handle('quiz:getResults',
    p => db.getQuizResults(p.userId, p.storyId),
    []
);

handle('quiz:getBestScore',
    p => db.getBestQuizScore(
        p.userId,
        p.storyId,
        p.quizNumber
    ),
    null
);

// ── Badges ───────────────────────────────────────────────────
handle('badge:award',
    p => db.awardBadge(p.userId, p.storyId, p.badgeType),
    null
);

handle('badge:getAll',
    p => db.getAllUserBadges(p),
    []
);

handle('badge:getAllOrdered',
    p => db.getAllUserBadgesOrdered(p),
    []
);

handle('badge:getStats',
    p => db.getBadgeStats(p),
    { gold: 0, silver: 0, bronze: 0, total: 0 }
);

handle('badge:getStory',
    p => db.getUserBadges(p.userId, p.storyId),
    []
);

handle('badge:has',
    p => db.hasBadge(p.userId, p.storyId, p.badgeCategory),
    false
);

handle('badge:upgrade', async p => {
    await db.awardBadge(p.userId, p.storyId, p.newBadgeType);
    return { success: true };
});

// ── User stats ───────────────────────────────────────────────
handle('user:getStats',
    p => db.getUserStats(p),
    null
);

handle('stats:get',
    p => db.getUserStats(p),
    null
);

