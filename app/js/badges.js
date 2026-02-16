// badges.js - Dynamic Badge Loading and Display

const { ipcRenderer } = require('electron');

// Check authentication
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
        
        // Get all user badges ordered by earned date (oldest first)
        const badges = await ipcRenderer.invoke('badge:getAllOrdered', currentUser.id);
        
        console.log('User badges:', badges);
        
        // Get badge statistics
        const stats = await ipcRenderer.invoke('badge:getStats', currentUser.id);
        
        console.log('Badge stats:', stats);
        
        // Display badges
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
    
    // Clear existing badges
    badgesGrid.innerHTML = '';
    
    // Update header with stats
    updateBadgeStats(stats);
    
    // If no badges, show empty state
    if (badges.length === 0) {
        showEmptyState(badgesGrid);
        return;
    }
    
    // Display earned badges (ordered by earned_at)
    badges.forEach((badge, index) => {
        const badgeItem = createBadgeElement(badge, index);
        badgesGrid.appendChild(badgeItem);
    });
    
    // Add locked badge placeholders (to fill the grid)
    const totalSlots = 12; // Show 2 rows of 6
    const lockedCount = totalSlots - badges.length;
    
    for (let i = 0; i < lockedCount; i++) {
        const lockedBadge = createLockedBadgeElement();
        badgesGrid.appendChild(lockedBadge);
    }
}

// ============================================
// CREATE BADGE ELEMENT
// ============================================
function createBadgeElement(badge, index) {
    const badgeItem = document.createElement('div');
    badgeItem.className = 'badge-item earned';
    badgeItem.setAttribute('data-badge-id', badge.id);
    
    // Get badge image path based on type
    const badgeImagePath = getBadgeImagePath(badge.badge_type);
    
    // Create badge content - just the image, no text labels
    badgeItem.innerHTML = `
        <img src="${badgeImagePath}" alt="${badge.badge_type} badge">
    `;
    
    // Add tooltip on hover
    badgeItem.title = getBadgeTooltip(badge);
    
    // Add click handler to show details
    badgeItem.addEventListener('click', () => showBadgeDetails(badge));
    
    return badgeItem;
}

// ============================================
// CREATE LOCKED BADGE ELEMENT
// ============================================
function createLockedBadgeElement() {
    const badgeItem = document.createElement('div');
    badgeItem.className = 'badge-item locked';
    
    badgeItem.innerHTML = `
        <img src="../../assets/images/badges/locked-badge.png" alt="Locked Badge">
    `;
    
    badgeItem.title = 'Complete more stories and quizzes to unlock!';
    
    return badgeItem;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getBadgeImagePath(badgeType) {
    const paths = {
        'gold': '../../assets/images/badges/gold-badge.png',
        'silver': '../../assets/images/badges/silver-badge.png',
        'bronze': '../../assets/images/badges/bronze-badge.png'
    };
    return paths[badgeType] || '../../assets/images/badges/bronze-badge.png';
}

function formatBadgeLabel(badge) {
    const storyId = badge.story_id;
    const category = badge.badge_category;
    const type = badge.badge_type;
    
    if (category === 'story-completion') {
        return `Story ${storyId} Complete`;
    } else if (category === 'quiz-1') {
        return `Story ${storyId} - Quiz 1`;
    } else if (category === 'quiz-2') {
        return `Story ${storyId} - Quiz 2`;
    }
    
    return `Story ${storyId}`;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function getBadgeTooltip(badge) {
    const type = badge.badge_type.toUpperCase();
    const label = formatBadgeLabel(badge);
    const date = formatDate(badge.earned_at);
    
    return `${type} BADGE\n${label}\nEarned: ${date}`;
}

// ============================================
// UPDATE BADGE STATS
// ============================================
function updateBadgeStats(stats) {
    const headerTitle = document.querySelector('.header-title');
    
    if (!headerTitle) return;
    
    // Add stats display below title
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
        <div class="stat-total">
            Total: ${stats.total} badges
        </div>
    `;
}

// ============================================
// SHOW EMPTY STATE
// ============================================
function showEmptyState(container) {
    container.innerHTML = `
        <div class="empty-state">
            <img src="../../assets/images/badges/locked-badge.png" alt="No badges" style="width: 120px; opacity: 0.5;">
            <h3>No Badges Yet!</h3>
            <p>Complete stories and quizzes to earn your first badge.</p>
            <button class="start-button" onclick="goToLibrary()">Start Reading</button>
        </div>
    `;
}

// ============================================
// SHOW BADGE DETAILS (MODAL)
// ============================================
function showBadgeDetails(badge) {
    // Create modal overlay
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
    
    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeBadgeModal();
        }
    });
}

function closeBadgeModal() {
    const modal = document.querySelector('.badge-modal');
    if (modal) {
        modal.remove();
    }
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
window.addEventListener('DOMContentLoaded', () => {
    loadBadges();
});

// Keyboard shortcut to close modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeBadgeModal();
    }
});