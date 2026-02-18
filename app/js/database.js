const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

class VocabVentureDB {
    constructor() {
        // Create database directory if it doesn't exist
      const { app } = require('electron');

const dbDir = app.getPath('userData');

if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'vocabventure.db');
        const dbExists = fs.existsSync(dbPath);
        
        this.db = new Database(dbPath);
        
        // Run migration if database already exists
        if (dbExists) {
            this.migrateIfNeeded();
        }
        
        // Create tables (will only create if they don't exist)
        this.initializeTables();
        
        console.log('Database initialized at:', dbPath);
    }

    migrateIfNeeded() {
        try {
            // Check if migrations are needed
            const needsMigration = this.checkIfMigrationNeeded();
            
            if (!needsMigration) {
                console.log('Database schema is up to date');
                return;
            }
            
            console.log('Running database migration...');
            
            // Start transaction
            this.db.exec('BEGIN TRANSACTION');
            
            try {
                // Migrate quiz_results table
                this.migrateQuizResults();
                
                // Migrate user_badges table
                this.migrateUserBadges();
                
                // Add last_viewed_segment column if needed
                this.migrateProgressTable();
                
                // Commit transaction
                this.db.exec('COMMIT');
                
                console.log('✅ Database migration completed successfully!');
            } catch (error) {
                this.db.exec('ROLLBACK');
                throw error;
            }
        } catch (error) {
            console.error('Migration error:', error);
            // Continue anyway - tables will be recreated if needed
        }
    }

    checkIfMigrationNeeded() {
        try {
            // Check if quiz_results has new columns
            const quizTableInfo = this.db.prepare("PRAGMA table_info(quiz_results)").all();
            const hasQuizNumber = quizTableInfo.some(col => col.name === 'quiz_number');
            const hasBadgeType = quizTableInfo.some(col => col.name === 'badge_type');
            
            // Check if user_badges has new columns
            const badgeTableInfo = this.db.prepare("PRAGMA table_info(user_badges)").all();
            const hasStoryId = badgeTableInfo.some(col => col.name === 'story_id');
            const hasBadgeCategory = badgeTableInfo.some(col => col.name === 'badge_category');
            
            return !hasQuizNumber || !hasBadgeType || !hasStoryId || !hasBadgeCategory;
        } catch (error) {
            // If tables don't exist, no migration needed
            return false;
        }
    }

    migrateProgressTable() {
        try {
            // Check if last_viewed_segment column exists
            const tableInfo = this.db.prepare("PRAGMA table_info(progress)").all();
            const hasLastViewed = tableInfo.some(col => col.name === 'last_viewed_segment');
            
            if (!hasLastViewed) {
                console.log('  Adding last_viewed_segment column to progress table...');
                this.db.exec(`ALTER TABLE progress ADD COLUMN last_viewed_segment INTEGER DEFAULT 1`);
                console.log('    ✓ Column added');
            }
        } catch (error) {
            console.log('    Note: Could not add last_viewed_segment column:', error.message);
        }
    }

    migrateQuizResults() {
        console.log('  Migrating quiz_results table...');
        
        // Get existing data
        const existingData = this.db.prepare('SELECT * FROM quiz_results').all();
        
        // Create new table with updated schema
        this.db.exec(`
            DROP TABLE IF EXISTS quiz_results_new;
            CREATE TABLE quiz_results_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                story_id INTEGER,
                quiz_number INTEGER,
                score INTEGER,
                total_questions INTEGER,
                badge_type TEXT,
                completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);
        
        // Migrate existing data
        if (existingData.length > 0) {
            const insertStmt = this.db.prepare(`
                INSERT INTO quiz_results_new 
                (id, user_id, story_id, quiz_number, score, total_questions, badge_type, completed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            for (const row of existingData) {
                const badgeType = this.calculateQuizBadge(row.score, row.total_questions);
                const quizNumber = row.quiz_number || 1;
                
                insertStmt.run(
                    row.id,
                    row.user_id,
                    row.story_id,
                    quizNumber,
                    row.score,
                    row.total_questions,
                    badgeType,
                    row.completed_at
                );
            }
            
            console.log(`    Migrated ${existingData.length} quiz results`);
        }
        
        // Replace old table with new one
        this.db.exec(`
            DROP TABLE quiz_results;
            ALTER TABLE quiz_results_new RENAME TO quiz_results;
        `);
        
        console.log('    ✓ quiz_results migrated');
    }

    migrateUserBadges() {
        console.log('  Migrating user_badges table...');
        
        // Get existing data
        const existingData = this.db.prepare('SELECT * FROM user_badges').all();
        
        // Create new table with updated schema
        this.db.exec(`
            DROP TABLE IF EXISTS user_badges_new;
            CREATE TABLE user_badges_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                story_id INTEGER,
                badge_type TEXT,
                badge_category TEXT,
                earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(user_id, story_id, badge_category)
            )
        `);
        
        // Migrate existing data
        if (existingData.length > 0) {
            const insertStmt = this.db.prepare(`
                INSERT OR IGNORE INTO user_badges_new 
                (id, user_id, story_id, badge_type, badge_category, earned_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            for (const row of existingData) {
                const { storyId, badgeType, badgeCategory } = this.parseLegacyBadgeId(row.badge_id);
                
                insertStmt.run(
                    row.id,
                    row.user_id,
                    storyId,
                    badgeType,
                    badgeCategory,
                    row.earned_at
                );
            }
            
            console.log(`    Migrated ${existingData.length} badges`);
        }
        
        // Replace old table with new one
        this.db.exec(`
            DROP TABLE user_badges;
            ALTER TABLE user_badges_new RENAME TO user_badges;
        `);
        
        console.log('    ✓ user_badges migrated');
    }

    parseLegacyBadgeId(badgeId) {
        let storyId = 1;
        let badgeType = 'gold';
        let badgeCategory = 'story-completion';
        
        if (!badgeId) {
            return { storyId, badgeType, badgeCategory };
        }
        
        // Extract story ID
        const storyMatch = badgeId.match(/story-?(\d+)/i);
        if (storyMatch) {
            storyId = parseInt(storyMatch[1]);
        }
        
        // Determine badge type
        if (badgeId.includes('gold')) {
            badgeType = 'gold';
        } else if (badgeId.includes('silver')) {
            badgeType = 'silver';
        } else if (badgeId.includes('bronze')) {
            badgeType = 'bronze';
        }
        
        // Determine badge category
        if (badgeId.includes('quiz1')) {
            badgeCategory = 'quiz-1';
        } else if (badgeId.includes('quiz2')) {
            badgeCategory = 'quiz-2';
        } else if (badgeId.includes('complete')) {
            badgeCategory = 'story-completion';
        }
        
        return { storyId, badgeType, badgeCategory };
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

        // Create progress table with last_viewed_segment
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                story_id INTEGER,
                segment_id INTEGER,
                completed BOOLEAN DEFAULT 0,
                completed_at DATETIME,
                last_viewed_segment INTEGER DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(user_id, story_id, segment_id)
            )
        `);
        
        // Ensure last_viewed_segment column exists for existing databases
        try {
            const tableInfo = this.db.prepare("PRAGMA table_info(progress)").all();
            const hasLastViewed = tableInfo.some(col => col.name === 'last_viewed_segment');
            
            if (!hasLastViewed) {
                console.log('Adding last_viewed_segment column to existing progress table...');
                this.db.exec(`ALTER TABLE progress ADD COLUMN last_viewed_segment INTEGER DEFAULT 1`);
                console.log('✓ Column added');
            }
        } catch (error) {
            // Column might already exist or table doesn't exist yet
            console.log('Note: Could not add last_viewed_segment column:', error.message);
        }

        // Create quiz_results table - REFINED with badge_type
        this.db.exec(`
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
            )
        `);

        // Create user_badges table - REFINED with badge_type and story_id
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS user_badges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                story_id INTEGER,
                badge_type TEXT,
                badge_category TEXT,
                earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(user_id, story_id, badge_category)
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

    // Save last viewed segment
    saveLastViewedSegment(userId, storyId, segmentId) {
        // Update or insert the last viewed segment
        const stmt = this.db.prepare(`
            INSERT INTO progress (user_id, story_id, segment_id, completed, last_viewed_segment)
            VALUES (?, ?, ?, 0, ?)
            ON CONFLICT(user_id, story_id, segment_id) 
            DO UPDATE SET last_viewed_segment = ?
        `);
        return stmt.run(userId, storyId, segmentId, segmentId, segmentId);
    }

    // Get last viewed segment
    getLastViewedSegment(userId, storyId) {
        const stmt = this.db.prepare(`
            SELECT MAX(last_viewed_segment) as last_segment
            FROM progress 
            WHERE user_id = ? AND story_id = ?
        `);
        const result = stmt.get(userId, storyId);
        return result && result.last_segment ? result.last_segment : 0;
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

    // Check if story is fully completed
    isStoryCompleted(userId, storyId, totalSegments) {
        const progress = this.getProgress(userId, storyId);
        return progress.filter(p => p.completed).length === totalSegments;
    }

    // ============================================
    // QUIZ METHODS - REFINED
    // ============================================
    
    saveQuizResult(userId, storyId, quizNumber, score, totalQuestions) {
        // Calculate badge type based on score
        const badgeType = this.calculateQuizBadge(score, totalQuestions);
        
        const stmt = this.db.prepare(`
            INSERT INTO quiz_results (user_id, story_id, quiz_number, score, total_questions, badge_type)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(userId, storyId, quizNumber, score, totalQuestions, badgeType);
    }

    calculateQuizBadge(score, totalQuestions) {
        if (score === totalQuestions) {
            return 'gold';
        } else if (score >= 3 && score <= 4) {
            return 'silver';
        } else {
            return 'bronze';
        }
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

    getBestQuizScore(userId, storyId, quizNumber) {
        const stmt = this.db.prepare(`
            SELECT MAX(score) as best_score, total_questions, badge_type
            FROM quiz_results 
            WHERE user_id = ? AND story_id = ? AND quiz_number = ?
        `);
        return stmt.get(userId, storyId, quizNumber);
    }

    // ============================================
    // BADGE METHODS - REFINED
    // ============================================
awardBadge(userId, storyId, badgeType, badgeCategory) {
    try {
        // Check if user already has a badge for this category
        const existingBadge = this.getStoryBadge(userId, storyId, badgeCategory);
        
        // Badge hierarchy: bronze < silver < gold
        const badgeHierarchy = { 'bronze': 1, 'silver': 2, 'gold': 3 };
        
        if (existingBadge) {
            const existingLevel = badgeHierarchy[existingBadge.badge_type] || 0;
            const newLevel = badgeHierarchy[badgeType] || 0;
            
            // Only update if the new badge is better
            if (newLevel > existingLevel) {
                console.log(`Upgrading badge for story ${storyId} ${badgeCategory}: ${existingBadge.badge_type} → ${badgeType}`);
                
                // Update the badge type (keeps original earned_at timestamp)
                const stmt = this.db.prepare(`
                    UPDATE user_badges 
                    SET badge_type = ?
                    WHERE user_id = ? AND story_id = ? AND badge_category = ?
                `);
                return stmt.run(badgeType, userId, storyId, badgeCategory);
            } else {
                console.log(`Badge already exists with same or better level: ${existingBadge.badge_type}`);
                return null; // Don't downgrade or duplicate
            }
        } else {
            // No existing badge, insert new one
            console.log(`Awarding new ${badgeType} badge for story ${storyId} ${badgeCategory}`);
            
            const stmt = this.db.prepare(`
                INSERT INTO user_badges (user_id, story_id, badge_type, badge_category)
                VALUES (?, ?, ?, ?)
            `);
            return stmt.run(userId, storyId, badgeType, badgeCategory);
        }
    } catch (error) {
        console.error('Error awarding badge:', error);
        return null;
    }
}

getStoryBadge(userId, storyId, badgeCategory) {
    const stmt = this.db.prepare(`
        SELECT * FROM user_badges 
        WHERE user_id = ? AND story_id = ? AND badge_category = ?
    `);
    return stmt.get(userId, storyId, badgeCategory);
}

// Get all badges ordered by earned_at (oldest first)
getAllUserBadgesOrdered(userId) {
    const stmt = this.db.prepare(`
        SELECT 
            ub.*,
            CASE 
                WHEN ub.badge_category = 'story-completion' THEN 'Story Complete'
                WHEN ub.badge_category = 'quiz-1' THEN 'Quiz 1'
                WHEN ub.badge_category = 'quiz-2' THEN 'Quiz 2'
                ELSE ub.badge_category
            END as badge_label
        FROM user_badges ub
        WHERE user_id = ?
        ORDER BY earned_at ASC
    `);
    return stmt.all(userId);
}

// Get badge statistics
getBadgeStats(userId) {
    const stmt = this.db.prepare(`
        SELECT 
            badge_type,
            COUNT(*) as count
        FROM user_badges
        WHERE user_id = ?
        GROUP BY badge_type
    `);
    const stats = stmt.all(userId);
    
    return {
        gold: stats.find(s => s.badge_type === 'gold')?.count || 0,
        silver: stats.find(s => s.badge_type === 'silver')?.count || 0,
        bronze: stats.find(s => s.badge_type === 'bronze')?.count || 0,
        total: stats.reduce((sum, s) => sum + s.count, 0)
    };
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
        const badges = this.getAllUserBadges(userId);
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

    // Get comprehensive story progress (for progress bar calculation)
    getStoryCompletionStatus(userId, storyId, totalSegments) {
        // Get story completion
        const storyProgress = this.getProgress(userId, storyId);
        const completedSegments = storyProgress.filter(p => p.completed).length;
        const storyCompleted = completedSegments === totalSegments;
        
        // Get quiz badges
        const quiz1Badge = this.getStoryBadge(userId, storyId, 'quiz-1');
        const quiz2Badge = this.getStoryBadge(userId, storyId, 'quiz-2');
        
        return {
            storyCompleted,
            completedSegments,
            totalSegments,
            quiz1Completed: quiz1Badge !== undefined,
            quiz2Completed: quiz2Badge !== undefined
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