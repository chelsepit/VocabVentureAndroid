// sqlite-capacitor.js — NO bundler required
// Uses the raw CapacitorSQLite plugin directly from window.Capacitor.Plugins

const DB_NAME = 'vocabventure';

function getPlugin() {
    const plugin = window?.Capacitor?.Plugins?.CapacitorSQLite;
    if (!plugin) throw new Error('CapacitorSQLite plugin not available');
    return plugin;
}

export const capacitorDB = {

    // ============================================
    // INIT
    // ============================================
    async init() {
        try {
            const plugin = getPlugin();

            // createConnection is safe to call even if connection exists —
            // we catch and ignore the "already exists" error
            try {
                await plugin.createConnection({
                    database: DB_NAME,
                    encrypted: false,
                    mode: 'no-encryption',
                    version: 1,
                    readonly: false
                });
            } catch (connErr) {
                // "already exists" is fine — just means we called init twice
                const msg = connErr?.message ?? '';
                if (!msg.toLowerCase().includes('already') && !msg.toLowerCase().includes('exist')) {
                    throw connErr;
                }
            }

                    await plugin.open({ database: DB_NAME, readonly: false });

            // ⚡ Only run table creation once per session, not every page load
            const alreadySetup = sessionStorage.getItem('db:tables_ready');
            if (!alreadySetup) {
                await this._initializeTables();
                sessionStorage.setItem('db:tables_ready', '1');
            }

console.log('✅ Capacitor SQLite initialized');
        } catch (error) {
            console.error('❌ DB init error:', error);
            throw error;
        }
    },

    // ============================================
    // LOW-LEVEL HELPERS
    // ============================================
    async run(sql, params = []) {
        const plugin = getPlugin();
        return await plugin.run({ database: DB_NAME, statement: sql, values: params, transaction: false });
    },

    async query(sql, params = []) {
        const plugin = getPlugin();
        const result = await plugin.query({ database: DB_NAME, statement: sql, values: params });
        return result.values ?? [];
    },

    async execute(sql) {
        const plugin = getPlugin();
        return await plugin.execute({ database: DB_NAME, statements: sql, transaction: false });
    },

    // ============================================
    // SCHEMA
    // ============================================
    async _initializeTables() {
        await this.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                birthdate TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(username, birthdate)
            );
        `);
        await this.execute(`
            CREATE TABLE IF NOT EXISTS progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                story_id INTEGER,
                segment_id INTEGER,
                completed INTEGER DEFAULT 0,
                completed_at DATETIME,
                last_viewed_segment INTEGER DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(user_id, story_id, segment_id)
            );
        `);
        await this.execute(`
            CREATE TABLE IF NOT EXISTS quiz_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                story_id INTEGER,
                quiz_number INTEGER,
                score INTEGER,
                total_questions INTEGER,
                badge_type TEXT,
                completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
        `);
        await this.execute(`
            CREATE TABLE IF NOT EXISTS user_badges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                story_id INTEGER,
                badge_type TEXT,
                badge_category TEXT,
                earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(user_id, story_id, badge_category)
            );
        `);

        // Safe migration for existing DBs
        try {
            const cols = await this.query('PRAGMA table_info(progress)', []);
            const hasCol = cols.some(c => c.name === 'last_viewed_segment');
            if (!hasCol) {
                await this.execute('ALTER TABLE progress ADD COLUMN last_viewed_segment INTEGER DEFAULT 1;');
            }
        } catch (_) { /* fresh install — column already in CREATE TABLE */ }
    },

    // ============================================
    // AUTH
    // ============================================
    async login(name, birthdate) {
        const rows = await this.query(
            'SELECT * FROM users WHERE username = ? AND birthdate = ?',
            [name, birthdate]
        );
        if (rows.length > 0) {
            const user = rows[0];
            return {
                success: true,
                user: { id: user.id, username: user.username, birthdate: user.birthdate, created_at: user.created_at }
            };
        }
        return { success: false, message: 'Invalid name or birthdate. Please try again or register.' };
    },

    async register(name, birthdate) {
        const existing = await this.query(
            'SELECT id FROM users WHERE username = ? AND birthdate = ?',
            [name, birthdate]
        );
        if (existing.length > 0) {
            return { success: false, message: 'An account with this name and birthdate already exists. Please login instead.' };
        }
        try {
            const result = await this.run(
                'INSERT INTO users (username, birthdate) VALUES (?, ?)',
                [name, birthdate]
            );
            return { success: true, userId: result.changes?.lastId, message: 'Account created successfully!' };
        } catch (error) {
            return { success: false, message: 'Failed to create account. Please try again.' };
        }
    },

    async getUser(userId) {
        const rows = await this.query('SELECT * FROM users WHERE id = ?', [userId]);
        return rows[0] ?? null;
    },

    // ============================================
    // PROGRESS
    // ============================================
    async saveProgress(userId, storyId, segmentId) {
        return await this.run(
            `INSERT OR REPLACE INTO progress (user_id, story_id, segment_id, completed, completed_at)
             VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`,
            [userId, storyId, segmentId]
        );
    },

    async saveLastViewedSegment(userId, storyId, segmentId) {
        return await this.run(
            `INSERT INTO progress (user_id, story_id, segment_id, completed, last_viewed_segment)
             VALUES (?, ?, ?, 0, ?)
             ON CONFLICT(user_id, story_id, segment_id)
             DO UPDATE SET last_viewed_segment = ?`,
            [userId, storyId, segmentId, segmentId, segmentId]
        );
    },

    async getLastViewedSegment(userId, storyId) {
        const rows = await this.query(
            `SELECT MAX(last_viewed_segment) as last_segment FROM progress WHERE user_id = ? AND story_id = ?`,
            [userId, storyId]
        );
        return rows[0]?.last_segment || 0;
    },

    async getProgress(userId, storyId) {
        return await this.query(
            `SELECT * FROM progress WHERE user_id = ? AND story_id = ? ORDER BY segment_id`,
            [userId, storyId]
        );
    },

    async getAllProgress(userId) {
        return await this.query(
            `SELECT story_id, COUNT(*) as completed_segments, 14 as total_segments,
                    MAX(completed_at) as last_activity
             FROM progress WHERE user_id = ? AND completed = 1 GROUP BY story_id`,
            [userId]
        );
    },

    async getOverallProgress(userId) {
        const rows = await this.query(
            `SELECT COUNT(*) as completed_segments FROM progress WHERE user_id = ? AND completed = 1`,
            [userId]
        );
        const completed = rows[0]?.completed_segments ?? 0;
        const total = 42;
        return { completed, total, percentage: Math.round((completed / total) * 100) };
    },

    async markSegmentComplete(userId, storyId, segmentId) {
        const result = await this.saveProgress(userId, storyId, segmentId);
        return { success: true, result };
    },

    // ============================================
    // STORY COMPLETION STATUS
    // ============================================
    async getStoryCompletionStatus(userId, storyId, totalSegments) {
        const progressRows = await this.getProgress(userId, storyId);
        const completedSegments = progressRows.filter(p => p.completed).length;
        const storyCompleted = completedSegments >= totalSegments;

        const quiz1Badge = await this._getStoryBadge(userId, storyId, 'quiz-1');
        const quiz2Badge = await this._getStoryBadge(userId, storyId, 'quiz-2');

        const lastAccessRows = await this.query(
            `SELECT MAX(completed_at) as lastAccessed FROM progress WHERE user_id = ? AND story_id = ?`,
            [userId, storyId]
        );

        return {
            completedSegments, totalSegments, storyCompleted,
            quiz1Completed: quiz1Badge !== null,
            quiz2Completed: quiz2Badge !== null,
            lastAccessed: lastAccessRows[0]?.lastAccessed ?? null
        };
    },

    // ============================================
    // BULK STORY COMPLETION STATUS (library page)
    // Replaces 90 individual queries with 3 bulk queries
    // ============================================
    async getAllStoriesCompletionStatus(userId) {
        // Query 1: all completed segments grouped by story
        const progressRows = await this.query(
            `SELECT story_id,
                    COUNT(*) as completed_segments,
                    MAX(completed_at) as lastAccessed
             FROM progress
             WHERE user_id = ? AND completed = 1
             GROUP BY story_id`,
            [userId]
        );

        // Query 2: all quiz badges for this user at once
        const badgeRows = await this.query(
            `SELECT story_id, badge_category
             FROM user_badges
             WHERE user_id = ? AND badge_category IN ('quiz-1', 'quiz-2')`,
            [userId]
        );

        // Build lookup maps from results
        const progressMap = {};
        progressRows.forEach(r => {
            progressMap[r.story_id] = {
                completedSegments: r.completed_segments,
                lastAccessed: r.lastAccessed
            };
        });

        const badgeMap = {};
        badgeRows.forEach(r => {
            if (!badgeMap[r.story_id]) badgeMap[r.story_id] = {};
            badgeMap[r.story_id][r.badge_category] = true;
        });

        return { progressMap, badgeMap };
    },

    // ============================================
    // QUIZ
    // ============================================
    async saveQuizResult(userId, storyId, quizNumber, score, totalQuestions) {
        const badgeType = this._calcQuizBadge(score, totalQuestions);
        return await this.run(
            `INSERT INTO quiz_results (user_id, story_id, quiz_number, score, total_questions, badge_type)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, storyId, quizNumber, score, totalQuestions, badgeType]
        );
    },

    async getQuizResults(userId, storyId) {
        return await this.query(
            `SELECT * FROM quiz_results WHERE user_id = ? AND story_id = ? ORDER BY completed_at DESC`,
            [userId, storyId]
        );
    },

    async getBestQuizScore(userId, storyId, quizNumber) {
        const rows = await this.query(
            `SELECT MAX(score) as best_score, total_questions, badge_type
             FROM quiz_results WHERE user_id = ? AND story_id = ? AND quiz_number = ?`,
            [userId, storyId, quizNumber]
        );
        return rows[0] ?? null;
    },

    _calcQuizBadge(score, total) {
        if (score === total) return 'gold';
        if (score >= 3 && score <= 4) return 'silver';
        return 'bronze';
    },

    // ============================================
    // BADGES
    // ============================================
    async awardBadge(userId, storyId, badgeType, badgeCategory) {
        const existing = await this._getStoryBadge(userId, storyId, badgeCategory);
        const hierarchy = { bronze: 1, silver: 2, gold: 3 };

        if (existing) {
            if ((hierarchy[badgeType] ?? 0) > (hierarchy[existing.badge_type] ?? 0)) {
                return await this.run(
                    `UPDATE user_badges SET badge_type = ? WHERE user_id = ? AND story_id = ? AND badge_category = ?`,
                    [badgeType, userId, storyId, badgeCategory]
                );
            }
            return null;
        }
        return await this.run(
            `INSERT INTO user_badges (user_id, story_id, badge_type, badge_category) VALUES (?, ?, ?, ?)`,
            [userId, storyId, badgeType, badgeCategory]
        );
    },

    async upgradeBadge(userId, storyId, newBadgeType) {
        await this.run(
            `DELETE FROM user_badges WHERE user_id = ? AND story_id = ? AND badge_category = 'story-completion'`,
            [userId, storyId]
        );
        await this.run(
            `INSERT INTO user_badges (user_id, story_id, badge_type, badge_category) VALUES (?, ?, ?, 'story-completion')`,
            [userId, storyId, newBadgeType]
        );
        return { success: true };
    },

    async getAllUserBadges(userId) {
        return await this.query(
            `SELECT * FROM user_badges WHERE user_id = ? ORDER BY earned_at DESC`, [userId]
        );
    },

    async getAllUserBadgesOrdered(userId) {
        return await this.query(
            `SELECT ub.*,
                CASE
                    WHEN ub.badge_category = 'story-completion' THEN 'Story Complete'
                    WHEN ub.badge_category = 'quiz-1' THEN 'Quiz 1'
                    WHEN ub.badge_category = 'quiz-2' THEN 'Quiz 2'
                    ELSE ub.badge_category
                END as badge_label
             FROM user_badges ub WHERE user_id = ? ORDER BY earned_at ASC`,
            [userId]
        );
    },

    async getBadgeStats(userId) {
        const rows = await this.query(
            `SELECT badge_type, COUNT(*) as count FROM user_badges WHERE user_id = ? GROUP BY badge_type`,
            [userId]
        );
        return {
            gold:   rows.find(r => r.badge_type === 'gold')?.count   ?? 0,
            silver: rows.find(r => r.badge_type === 'silver')?.count ?? 0,
            bronze: rows.find(r => r.badge_type === 'bronze')?.count ?? 0,
            total:  rows.reduce((s, r) => s + r.count, 0)
        };
    },

    async getUserBadges(userId, storyId) {
        return await this.query(
            `SELECT * FROM user_badges WHERE user_id = ? AND story_id = ?`, [userId, storyId]
        );
    },

    async hasBadge(userId, storyId, badgeCategory) {
        const rows = await this.query(
            `SELECT id FROM user_badges WHERE user_id = ? AND story_id = ? AND badge_category = ?`,
            [userId, storyId, badgeCategory]
        );
        return rows.length > 0;
    },

    async _getStoryBadge(userId, storyId, badgeCategory) {
        const rows = await this.query(
            `SELECT * FROM user_badges WHERE user_id = ? AND story_id = ? AND badge_category = ?`,
            [userId, storyId, badgeCategory]
        );
        return rows[0] ?? null;
    },

    // ============================================
    // USER STATS
    // ============================================
    async getUserStats(userId) {
        const progress = await this.getOverallProgress(userId);
        const badges = await this.getAllUserBadges(userId);
        const quizResults = await this.query(
            `SELECT score, total_questions FROM quiz_results WHERE user_id = ?`, [userId]
        );
        const avgScore = quizResults.length > 0
            ? quizResults.reduce((s, q) => s + (q.score / q.total_questions * 100), 0) / quizResults.length
            : 0;
        return {
            progress,
            totalBadges: badges.length,
            totalQuizzes: quizResults.length,
            averageQuizScore: Math.round(avgScore)
        };
    }
};