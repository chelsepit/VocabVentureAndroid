// db-interface.js
// ============================================================
// THE ONLY FILE ALL OTHER JS FILES SHOULD IMPORT FOR DATABASE.
// Never import sqlite-capacitor.js directly from app pages.
// ============================================================

import { capacitorDB } from './sqlite-capacitor.js';

export const db = capacitorDB;

// Call this once when the app starts (e.g. in your main index.html script)
export async function initDB() {
    await db.init();
}
