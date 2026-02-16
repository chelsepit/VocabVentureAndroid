// run-migration.js - Standalone Database Migration Script
// Run this file once to migrate your existing database to the new schema

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log('='.repeat(60));
console.log('VocabVenture Database Migration Tool');
console.log('='.repeat(60));

const dbDir = path.join(__dirname, '../../database');
const dbPath = path.join(dbDir, 'vocabventure.db');

if (!fs.existsSync(dbPath)) {
    console.log('❌ No existing database found at:', dbPath);
    console.log('The database will be created with the new schema when you run the app.');
    process.exit(0);
}

console.log('📁 Database location:', dbPath);
console.log('');

// Backup the database first
const backupPath = path.join(dbDir, `vocabventure_backup_${Date.now()}.db`);
console.log('📦 Creating backup at:', backupPath);
fs.copyFileSync(dbPath, backupPath);
console.log('✅ Backup created successfully!');
console.log('');

const db = new Database(dbPath);

try {
    console.log('🔍 Checking current database schema...');
    
    // Check quiz_results table
    const quizTableInfo = db.prepare("PRAGMA table_info(quiz_results)").all();
    const hasQuizNumber = quizTableInfo.some(col => col.name === 'quiz_number');
    const hasBadgeType = quizTableInfo.some(col => col.name === 'badge_type');
    
    console.log('  quiz_results table:');
    console.log('    - quiz_number column:', hasQuizNumber ? '✓' : '✗ (needs migration)');
    console.log('    - badge_type column:', hasBadgeType ? '✓' : '✗ (needs migration)');
    
    // Check user_badges table
    const badgeTableInfo = db.prepare("PRAGMA table_info(user_badges)").all();
    const hasStoryId = badgeTableInfo.some(col => col.name === 'story_id');
    const hasBadgeCategory = badgeTableInfo.some(col => col.name === 'badge_category');
    
    console.log('  user_badges table:');
    console.log('    - story_id column:', hasStoryId ? '✓' : '✗ (needs migration)');
    console.log('    - badge_category column:', hasBadgeCategory ? '✓' : '✗ (needs migration)');
    console.log('');
    
    const needsMigration = !hasQuizNumber || !hasBadgeType || !hasStoryId || !hasBadgeCategory;
    
    if (!needsMigration) {
        console.log('✅ Database is already up to date! No migration needed.');
        db.close();
        process.exit(0);
    }
    
    console.log('⚠️  Migration required!');
    console.log('');
    console.log('🚀 Starting migration...');
    
    // Start transaction
    db.exec('BEGIN TRANSACTION');
    
    // Migrate quiz_results
    if (!hasQuizNumber || !hasBadgeType) {
        console.log('');
        console.log('📝 Migrating quiz_results table...');
        
        const existingQuizData = db.prepare('SELECT * FROM quiz_results').all();
        console.log(`   Found ${existingQuizData.length} existing quiz results`);
        
        db.exec(`
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
        
        if (existingQuizData.length > 0) {
            const insertStmt = db.prepare(`
                INSERT INTO quiz_results_new 
                (id, user_id, story_id, quiz_number, score, total_questions, badge_type, completed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            for (const row of existingQuizData) {
                const score = row.score;
                const total = row.total_questions;
                const badgeType = (score === total) ? 'gold' : (score >= 3 && score <= 4) ? 'silver' : 'bronze';
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
            
            console.log(`   ✓ Migrated ${existingQuizData.length} quiz results`);
        }
        
        db.exec(`
            DROP TABLE quiz_results;
            ALTER TABLE quiz_results_new RENAME TO quiz_results;
        `);
        
        console.log('   ✅ quiz_results table migration complete');
    }
    
    // Migrate user_badges
    if (!hasStoryId || !hasBadgeCategory) {
        console.log('');
        console.log('🏆 Migrating user_badges table...');
        
        const existingBadgeData = db.prepare('SELECT * FROM user_badges').all();
        console.log(`   Found ${existingBadgeData.length} existing badges`);
        
        db.exec(`
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
        
        if (existingBadgeData.length > 0) {
            const insertStmt = db.prepare(`
                INSERT OR IGNORE INTO user_badges_new 
                (id, user_id, story_id, badge_type, badge_category, earned_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            for (const row of existingBadgeData) {
                const badgeId = row.badge_id || '';
                
                // Parse legacy badge_id
                let storyId = 1;
                let badgeType = 'gold';
                let badgeCategory = 'story-completion';
                
                const storyMatch = badgeId.match(/story-?(\d+)/i);
                if (storyMatch) storyId = parseInt(storyMatch[1]);
                
                if (badgeId.includes('gold')) badgeType = 'gold';
                else if (badgeId.includes('silver')) badgeType = 'silver';
                else if (badgeId.includes('bronze')) badgeType = 'bronze';
                
                if (badgeId.includes('quiz1')) badgeCategory = 'quiz-1';
                else if (badgeId.includes('quiz2')) badgeCategory = 'quiz-2';
                else if (badgeId.includes('complete')) badgeCategory = 'story-completion';
                
                insertStmt.run(
                    row.id,
                    row.user_id,
                    storyId,
                    badgeType,
                    badgeCategory,
                    row.earned_at
                );
            }
            
            console.log(`   ✓ Migrated ${existingBadgeData.length} badges`);
        }
        
        db.exec(`
            DROP TABLE user_badges;
            ALTER TABLE user_badges_new RENAME TO user_badges;
        `);
        
        console.log('   ✅ user_badges table migration complete');
    }
    
    // Commit transaction
    db.exec('COMMIT');
    
    console.log('');
    console.log('='.repeat(60));
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Your database has been updated to the new schema.');
    console.log('Backup saved at:', backupPath);
    console.log('');
    console.log('You can now run your application normally.');
    
} catch (error) {
    console.error('');
    console.error('❌ MIGRATION FAILED!');
    console.error('Error:', error.message);
    console.error('');
    console.error('Rolling back changes...');
    
    try {
        db.exec('ROLLBACK');
        console.log('✓ Changes rolled back successfully');
    } catch (rollbackError) {
        console.error('✗ Rollback failed:', rollbackError.message);
    }
    
    console.error('');
    console.error('Your original database backup is at:', backupPath);
    console.error('You can restore it if needed by copying it back to:', dbPath);
    
    process.exit(1);
} finally {
    db.close();
}