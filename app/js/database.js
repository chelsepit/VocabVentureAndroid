const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class VocabVentureDB {
    constructor() {
        // Create database directory if it doesn't exist
        const dbDir = path.join(__dirname, '../../database');
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        // Initialize database
        const dbPath = path.join(dbDir, 'vocabventure.db');
        this.db = new Database(dbPath);
        
        // Create tables
        this.initializeTables();
        
        console.log('Database initialized at:', dbPath);
    }

    initializeTables() {
        // Create users table (with birthdate for authentication)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                birthdate TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(username, birthdate)
            )
        `);

        // Create progress table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                story_id INTEGER,
                segment_id INTEGER,
                completed BOOLEAN DEFAULT 0,
                completed_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(user_id, story_id, segment_id)
            )
        `);

        // Create quiz_results table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS quiz_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                story_id INTEGER,
                score INTEGER,
                total_questions INTEGER,
                completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // Create user_badges table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS user_badges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                badge_id TEXT,
                earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(user_id, badge_id)
            )
        `);

        console.log('Database tables created successfully!');
    }

    // ============================================
    // AUTHENTICATION METHODS
    // ============================================
    
    login(name, birthdate) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE username = ? AND birthdate = ?');
        const user = stmt.get(name, birthdate);
        
        if (user) {
            return {
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    birthdate: user.birthdate,
                    created_at: user.created_at
                }
            };
        }
        
        return {
            success: false,
            message: 'Invalid name or birthdate. Please try again or register.'
        };
    }

    register(name, birthdate) {
        // Check if user already exists
        const existing = this.db.prepare('SELECT * FROM users WHERE username = ? AND birthdate = ?')
            .get(name, birthdate);
        
        if (existing) {
            return {
                success: false,
                message: 'An account with this name and birthdate already exists. Please login instead.'
            };
        }

        try {
            const stmt = this.db.prepare('INSERT INTO users (username, birthdate) VALUES (?, ?)');
            const result = stmt.run(name, birthdate);
            
            return {
                success: true,
                userId: result.lastInsertRowid,
                message: 'Account created successfully!'
            };
        } catch (error) {
            console.error('Registration error:', error);
            return {
                success: false,
                message: 'Failed to create account. Please try again.'
            };
        }
    }

    // ============================================
    // USER METHODS
    // ============================================
    
    getUser(userId) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
        return stmt.get(userId);
    }

    getUserByUsername(username) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
        return stmt.get(username);
    }

    getAllUsers() {
        const stmt = this.db.prepare('SELECT * FROM users ORDER BY created_at DESC');
        return stmt.all();
    }

    // ============================================
    // PROGRESS METHODS
    // ============================================
    
    saveProgress(userId, storyId, segmentId) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO progress (user_id, story_id, segment_id, completed, completed_at)
            VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
        `);
        return stmt.run(userId, storyId, segmentId);
    }

    getProgress(userId, storyId) {
        const stmt = this.db.prepare(`
            SELECT * FROM progress 
            WHERE user_id = ? AND story_id = ? 
            ORDER BY segment_id
        `);
        return stmt.all(userId, storyId);
    }

    getStoryProgress(userId, storyId) {
        const stmt = this.db.prepare(`
            SELECT 
                COUNT(*) as completed_segments,
                14 as total_segments
            FROM progress 
            WHERE user_id = ? AND story_id = ? AND completed = 1
        `);
        return stmt.get(userId, storyId);
    }

    getAllProgress(userId) {
        const stmt = this.db.prepare(`
            SELECT 
                story_id,
                COUNT(*) as completed_segments,
                14 as total_segments,
                MAX(completed_at) as last_activity
            FROM progress 
            WHERE user_id = ? AND completed = 1
            GROUP BY story_id
        `);
        return stmt.all(userId);
    }

    // ============================================
    // QUIZ METHODS
    // ============================================
    
    saveQuizResult(userId, storyId, score, totalQuestions) {
        const stmt = this.db.prepare(`
            INSERT INTO quiz_results (user_id, story_id, score, total_questions)
            VALUES (?, ?, ?, ?)
        `);
        return stmt.run(userId, storyId, score, totalQuestions);
    }

    getQuizResults(userId, storyId = null) {
        if (storyId) {
            const stmt = this.db.prepare(`
                SELECT * FROM quiz_results 
                WHERE user_id = ? AND story_id = ?
                ORDER BY completed_at DESC
            `);
            return stmt.all(userId, storyId);
        } else {
            const stmt = this.db.prepare(`
                SELECT * FROM quiz_results 
                WHERE user_id = ? 
                ORDER BY completed_at DESC
            `);
            return stmt.all(userId);
        }
    }

    getBestQuizScore(userId, storyId) {
        const stmt = this.db.prepare(`
            SELECT MAX(score) as best_score, total_questions
            FROM quiz_results 
            WHERE user_id = ? AND story_id = ?
        `);
        return stmt.get(userId, storyId);
    }

    // ============================================
    // BADGE METHODS
    // ============================================
    
    awardBadge(userId, badgeId) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO user_badges (user_id, badge_id)
                VALUES (?, ?)
            `);
            return stmt.run(userId, badgeId);
        } catch (error) {
            // Badge already awarded, ignore
            return null;
        }
    }

    getUserBadges(userId) {
        const stmt = this.db.prepare(`
            SELECT * FROM user_badges 
            WHERE user_id = ?
            ORDER BY earned_at DESC
        `);
        return stmt.all(userId);
    }

    hasBadge(userId, badgeId) {
        const stmt = this.db.prepare(`
            SELECT COUNT(*) as count FROM user_badges 
            WHERE user_id = ? AND badge_id = ?
        `);
        const result = stmt.get(userId, badgeId);
        return result.count > 0;
    }

    // ============================================
    // ANALYTICS METHODS
    // ============================================
    
    getOverallProgress(userId) {
        const stmt = this.db.prepare(`
            SELECT 
                COUNT(*) as completed_segments,
                42 as total_segments
            FROM progress 
            WHERE user_id = ? AND completed = 1
        `);
        const result = stmt.get(userId);
        
        return {
            completed: result.completed_segments,
            total: result.total_segments,
            percentage: Math.round((result.completed_segments / result.total_segments) * 100)
        };
    }

    getUserStats(userId) {
        const progress = this.getOverallProgress(userId);
        const badges = this.getUserBadges(userId);
        const quizResults = this.getQuizResults(userId);
        
        const avgScore = quizResults.length > 0
            ? quizResults.reduce((sum, q) => sum + (q.score / q.total_questions * 100), 0) / quizResults.length
            : 0;

        return {
            progress: progress,
            totalBadges: badges.length,
            totalQuizzes: quizResults.length,
            averageQuizScore: Math.round(avgScore)
        };
    }

    // ============================================
    // CLEANUP
    // ============================================
    
    close() {
        this.db.close();
    }
}

module.exports = VocabVentureDB;