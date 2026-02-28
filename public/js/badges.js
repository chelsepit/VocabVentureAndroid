// badges.js — Capacitor/Android version
// REMOVED: const { ipcRenderer } = require('electron')
// REPLACED: ipcRenderer.invoke('badge:getAllOrdered', ...) → db.getAllUserBadgesOrdered(...)
// REPLACED: ipcRenderer.invoke('badge:getStats', ...)      → db.getBadgeStats(...)
// FIXED:    duplicate DOMContentLoaded listeners merged into one
// FIXED:    wait for db:ready before loading badges so SQLite is ready on Android

import { db } from './db/db-interface.js';

const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser) {
    window.location.href = '../auth/login.html';
}

// ============================================
// LOAD USER BADGES
// ============================================
async function loadBadges() {
    try {
        console.log('Loading badges for user:', currentUser.id);

        // CHANGED: was ipcRenderer.invoke('badge:getAllOrdered', currentUser.id)
        const badges = await db.getAllUserBadgesOrdered(currentUser.id);
        console.log('User badges:', badges);

        // CHANGED: was ipcRenderer.invoke('badge:getStats', currentUser.id)
        const stats = await db.getBadgeStats(currentUser.id);
        console.log('Badge stats:', stats);

        displayBadges(badges, stats);

    } catch (error) {
        console.error('Error loading badges:', error);
    }
}

// ============================================
// DISPLAY BADGES
// ============================================
function displayBadges(badges, stats) {
    const badgesGrid = document.querySelector('.badges-grid');

    if (!badgesGrid) {
        console.error('Badges grid not found');
        return;
    }

    badgesGrid.innerHTML = '';
    updateBadgeStats(stats);

    if (badges.length === 0) {
        showEmptyState(badgesGrid);
        return;
    }

    badges.forEach((badge, index) => {
        const badgeItem = createBadgeElement(badge, index);
        badgesGrid.appendChild(badgeItem);
    });

    // Fill remaining slots with locked placeholders (max 12 slots = 2 rows of 6)
    const lockedCount = Math.max(0, 12 - badges.length);
    for (let i = 0; i < lockedCount; i++) {
        badgesGrid.appendChild(createLockedBadgeElement());
    }
}

// ============================================
// CREATE BADGE ELEMENT
// ============================================
function createBadgeElement(badge, index) {
    const badgeItem = document.createElement('div');
    badgeItem.className = 'badge-item earned';
    badgeItem.setAttribute('data-badge-id', badge.id);

    badgeItem.innerHTML = `<img src="${getBadgeImagePath(badge.badge_type)}" alt="${badge.badge_type} badge">`;
    badgeItem.title = getBadgeTooltip(badge);
    badgeItem.addEventListener('click', () => showBadgeDetails(badge));

    return badgeItem;
}

// ============================================
// CREATE LOCKED BADGE ELEMENT
// ============================================
function createLockedBadgeElement() {
    const badgeItem = document.createElement('div');
    badgeItem.className = 'badge-item locked';
    badgeItem.innerHTML = `<img src="../../assets/images/badges/locked-badge.png" alt="Locked Badge">`;
    badgeItem.title = 'Complete more stories and quizzes to unlock!';
    return badgeItem;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getBadgeImagePath(badgeType) {
    const paths = {
        'gold':   '../../assets/images/badges/gold-badge.png',
        'silver': '../../assets/images/badges/silver-badge.png',
        'bronze': '../../assets/images/badges/bronze-badge.png'
    };
    return paths[badgeType] || '../../assets/images/badges/bronze-badge.png';
}

let storyTitles = {};

async function loadStoryTitles() {
    try {
        const response = await fetch('../../data/stories-index.json');
        const data = await response.json();
        data.stories.forEach(story => {
            storyTitles[story.id] = story.title;
        });
    } catch (err) {
        console.error('Could not load story titles:', err);
    }
}

function formatBadgeLabel(badge) {
    const title    = storyTitles[badge.story_id] || `Story ${badge.story_id}`;
    const category = badge.badge_category;

    if (category === 'story-completion') return `${title} Complete`;
    if (category === 'quiz-1')           return `${title} - Quiz 1`;
    if (category === 'quiz-2')           return `${title} - Quiz 2`;
    return title;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getBadgeTooltip(badge) {
    const type    = badge.badge_type.toUpperCase();
    const storyId = badge.story_id;
    const date    = formatDate(badge.earned_at);

    let achievement;
    if (badge.badge_type === 'gold') {
        achievement = `Story ${storyId} completed\nQuiz 1 passed ✓\nQuiz 2 passed ✓`;
    } else if (badge.badge_type === 'silver') {
        achievement = `Story ${storyId} completed\nQuiz 1 passed ✓`;
    } else {
        achievement = `Story ${storyId} completed`;
    }

    return `${type} BADGE\n${achievement}\nEarned: ${date}`;
}

// ============================================
// UPDATE BADGE STATS
// ============================================
function updateBadgeStats(stats) {
    const headerTitle = document.querySelector('.header-title');
    if (!headerTitle) return;

    let statsDisplay = document.querySelector('.badge-stats');
    if (!statsDisplay) {
        statsDisplay = document.createElement('div');
        statsDisplay.className = 'badge-stats';
        headerTitle.insertAdjacentElement('afterend', statsDisplay);
    }

    statsDisplay.innerHTML = `
        <div class="stat-item">
            <img src="../../assets/images/badges/gold-badge.png" alt="Gold">
            <span>${stats.gold}</span>
        </div>
        <div class="stat-item">
            <img src="../../assets/images/badges/silver-badge.png" alt="Silver">
            <span>${stats.silver}</span>
        </div>
        <div class="stat-item">
            <img src="../../assets/images/badges/bronze-badge.png" alt="Bronze">
            <span>${stats.bronze}</span>
        </div>
        <div class="stat-total">Total: ${stats.total} badges</div>
    `;
}

// ============================================
// SHOW EMPTY STATE
// ============================================
function showEmptyState(container) {
    container.innerHTML = `
        <div class="empty-state" style="
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
        ">
            <img src="../../assets/images/badges/locked-badge.png" alt="No badges" style="width: 120px; opacity: 0.5;">
            
            <div style="
                background: rgba(255, 255, 255, 0.82);
                backdrop-filter: blur(6px);
                border-radius: 24px;
                padding: 18px 32px;
                margin: 12px auto 0;
                max-width: 600px;
                width: 100%;
                text-align: center;
                box-shadow: 0 4px 16px rgba(0,0,0,0.08);
            ">
                <h3 style="color:#7B3F00;font-size:2rem;font-weight:800;margin:0 0 10px;line-height:1.3;">
                    No Badges Yet!
                </h3>
                <p style="color:#5a3a1a;font-size:1.8rem;font-weight:600;margin:0;line-height:1.6;text-align:justify;text-align-last:center;">
                    Complete stories and quizzes to earn your first badge.
                </p>
            </div>

            <button
                class="start-button header-font font-extrabold"
                onclick="goToLibrary()"
                style="
                    margin-top: 50px;
                    width: 100%;
                    max-width: 320px;
                    color: #ffffff;
                    font-size: 1.8rem;
                    padding: 20px 32px;
                    border-radius: 40px;
                    border: 3px solid #FF6B35;
                    cursor: pointer;
                    background: linear-gradient(180deg, #FFB74D 0%, #FF9800 100%);
                    box-shadow: 0 6px 0 #E65100, 0 10px 15px rgba(0,0,0,0.2);
                    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
                    min-height: 80px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-decoration: none;
                    white-space: nowrap;
                "
                onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 10px 24px rgba(255,107,53,0.4)';"
                onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 6px 16px rgba(255,107,53,0.3)';"
                onmousedown="this.style.transform='scale(0.95)';"
                onmouseup="this.style.transform='translateY(-2px)';"
            >
                Start Reading
            </button>
        </div>
    `;
}

// ============================================
// SHOW BADGE DETAILS (MODAL)
// ============================================
function showBadgeDetails(badge) {
    const modal = document.createElement('div');
    modal.className = 'badge-modal';
    modal.innerHTML = `
        <div class="badge-modal-content">
            <button class="close-modal" onclick="closeBadgeModal()">&times;</button>
            <img src="${getBadgeImagePath(badge.badge_type)}" alt="${badge.badge_type} badge" class="modal-badge-image">
            <h2>${badge.badge_type.toUpperCase()} BADGE</h2>
            <p class="modal-badge-label">${formatBadgeLabel(badge)}</p>
            <p class="modal-badge-date">Earned on ${formatDate(badge.earned_at)}</p>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeBadgeModal(); });
}

function closeBadgeModal() {
    document.querySelector('.badge-modal')?.remove();
}

// ============================================
// NAVIGATION
// ============================================
function goToLibrary() {
    window.location.href = 'library.html';
}

// ============================================
// INITIALIZE ON PAGE LOAD
// ============================================

// FIXED: was two separate DOMContentLoaded listeners that raced each other —
//   Listener 1: awaited loadStoryTitles() but then never called loadBadges()
//   Listener 2: called loadBadges() but without waiting for story titles first
// Now merged into one listener that runs both in the correct order.
// Also waits for db:ready so SQLite is guaranteed initialized on Android.
document.addEventListener('DOMContentLoaded', async () => {
    await loadStoryTitles();  // load titles first so formatBadgeLabel() works in modals

    // ✅ Wait for DB before querying badges
    if (window.__dbReady) {
        await loadBadges();
    } else {
        document.addEventListener('db:ready', () => loadBadges(), { once: true });
    }
});

// Keyboard shortcut to close modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeBadgeModal();
});