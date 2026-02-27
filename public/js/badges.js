// badges.js — Capacitor/Android version
// REMOVED: const { ipcRenderer } = require('electron')
// REPLACED: ipcRenderer.invoke → direct db calls

import { db } from './db/db-interface.js';

const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser) {
    window.location.href = '../auth/login.html';
}

async function loadBadges() {
    try {
        const badges = await db.getAllUserBadgesOrdered(currentUser.id);
        const stats = await db.getBadgeStats(currentUser.id);
        displayBadges(badges, stats);
    } catch (error) {
        console.error('Error loading badges:', error);
    }
}

function displayBadges(badges, stats) {
    const badgesGrid = document.querySelector('.badges-grid');
    if (!badgesGrid) return;

    badgesGrid.innerHTML = '';
    updateBadgeStats(stats);

    if (badges.length === 0) {
        showEmptyState(badgesGrid);
        return;
    }

    badges.forEach((badge, index) => {
        badgesGrid.appendChild(createBadgeElement(badge, index));
    });

    const totalSlots = 12;
    const lockedCount = totalSlots - badges.length;
    for (let i = 0; i < lockedCount; i++) {
        badgesGrid.appendChild(createLockedBadgeElement());
    }
}

function createBadgeElement(badge, index) {
    const badgeItem = document.createElement('div');
    badgeItem.className = 'badge-item earned';
    badgeItem.setAttribute('data-badge-id', badge.id);
    badgeItem.innerHTML = `<img src="${getBadgeImagePath(badge.badge_type)}" alt="${badge.badge_type} badge">`;
    badgeItem.title = getBadgeTooltip(badge);
    badgeItem.addEventListener('click', () => showBadgeDetails(badge));
    return badgeItem;
}

function createLockedBadgeElement() {
    const badgeItem = document.createElement('div');
    badgeItem.className = 'badge-item locked';
    badgeItem.innerHTML = `<img src="../../assets/images/badges/locked-badge.png" alt="Locked Badge">`;
    badgeItem.title = 'Complete more stories and quizzes to unlock!';
    return badgeItem;
}

function getBadgeImagePath(badgeType) {
    const paths = {
        'gold':   '../../assets/images/badges/gold-badge.png',
        'silver': '../../assets/images/badges/silver-badge.png',
        'bronze': '../../assets/images/badges/bronze-badge.png'
    };
    return paths[badgeType] || '../../assets/images/badges/bronze-badge.png';
}

function formatBadgeLabel(badge) {
    const cat = badge.badge_category;
    if (cat === 'story-completion') return `Story ${badge.story_id} Complete`;
    if (cat === 'quiz-1') return `Story ${badge.story_id} - Quiz 1`;
    if (cat === 'quiz-2') return `Story ${badge.story_id} - Quiz 2`;
    return `Story ${badge.story_id}`;
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getBadgeTooltip(badge) {
    return `${badge.badge_type.toUpperCase()} BADGE\n${formatBadgeLabel(badge)}\nEarned: ${formatDate(badge.earned_at)}`;
}

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
            <img src="../../assets/images/badges/gold-badge.png" alt="Gold"><span>${stats.gold}</span>
        </div>
        <div class="stat-item">
            <img src="../../assets/images/badges/silver-badge.png" alt="Silver"><span>${stats.silver}</span>
        </div>
        <div class="stat-item">
            <img src="../../assets/images/badges/bronze-badge.png" alt="Bronze"><span>${stats.bronze}</span>
        </div>
        <div class="stat-total">Total: ${stats.total} badges</div>
    `;
}

function showEmptyState(container) {
    container.innerHTML = `
        <div class="empty-state">
            <img src="../../assets/images/badges/locked-badge.png" alt="No badges" style="width:120px;opacity:0.5;">
            <h3>No Badges Yet!</h3>
            <p>Complete stories and quizzes to earn your first badge.</p>
            <button class="start-button" onclick="goToLibrary()">Start Reading</button>
        </div>
    `;
}

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

window.closeBadgeModal = function closeBadgeModal() {
    document.querySelector('.badge-modal')?.remove();
}

window.goToLibrary = function goToLibrary() {
    window.location.href = 'library.html';
}

window.addEventListener('DOMContentLoaded', () => loadBadges());
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBadgeModal(); });