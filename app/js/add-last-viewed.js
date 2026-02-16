// add-last-viewed-column.js - Quick Migration Script
// Run this once to add the missing last_viewed_segment column

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log('='.repeat(60));
console.log('Adding last_viewed_segment column to progress table');
console.log('='.repeat(60));

const dbDir = path.join(__dirname, '../../database');
const dbPath = path.join(dbDir, 'vocabventure.db');

if (!fs.existsSync(dbPath)) {
    console.log('❌ No database found at:', dbPath);
    console.log('The database will be created with the column when you run the app.');
    process.exit(0);
}

console.log('📁 Database location:', dbPath);
console.log('');

const db = new Database(dbPath);

try {
    // Check if column already exists
    const tableInfo = db.prepare("PRAGMA table_info(progress)").all();
    const hasLastViewed = tableInfo.some(col => col.name === 'last_viewed_segment');
    
    if (hasLastViewed) {
        console.log('✅ Column already exists! No migration needed.');
        db.close();
        process.exit(0);
    }
    
    console.log('Adding last_viewed_segment column...');
    
    // Add the column
    db.exec(`ALTER TABLE progress ADD COLUMN last_viewed_segment INTEGER DEFAULT 1`);
    
    console.log('✅ Column added successfully!');
    console.log('');
    console.log('The progress table now has the last_viewed_segment column.');
    console.log('You can now restart your app.');
    
} catch (error) {
    console.error('❌ Error:', error.message);
    console.error('');
    console.error('If the error says "duplicate column name", the column already exists.');
    console.error('In that case, you can ignore this error.');
} finally {
    db.close();
}