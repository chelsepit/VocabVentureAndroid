// badges.js - Dynamic Badge Loading and Display
// Uses bridge.js instead of ipcRenderer — works on Electron AND Android.

const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser) window.location.href = '../auth/login.html';

async function loadBadges() {
    try {
        const badges = await bridge.invoke('badge:getAllOrdered', currentUser.id);
        const stats  = await bridge.invoke('badge:getStats', currentUser.id);
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

    badges.forEach((badge, index) => badgesGrid.appendChild(createBadgeElement(badge, index)));

    const totalSlots = 12;
    const lockedCount = totalSlots - badges.length;
    for (let i = 0; i < lockedCount; i++) badgesGrid.appendChild(createLockedBadgeElement());
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
        gold:   '../../assets/images/badges/gold-badge.png',
        silver: '../../assets/images/badges/silver-badge.png',
        bronze: '../../assets/images/badges/bronze-badge.png'
    };
    return paths[badgeType] || paths.bronze;
}

function formatBadgeLabel(badge) {
    const { story_id: storyId, badge_category: category } = badge;
    if (category === 'story-completion') return `Story ${storyId} Complete`;
    if (category === 'quiz-1')           return `Story ${storyId} - Quiz 1`;
    if (category === 'quiz-2')           return `Story ${storyId} - Quiz 2`;
    return `Story ${storyId}`;
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getBadgeTooltip(badge) {
    const type  = badge.badge_type.toUpperCase();
    const story = badge.story_id;
    const date  = formatDate(badge.earned_at);
    let achievement;
    if (badge.badge_type === 'gold')        achievement = `Story ${story} completed\nQuiz 1 passed ✓\nQuiz 2 passed ✓`;
    else if (badge.badge_type === 'silver') achievement = `Story ${story} completed\nQuiz 1 passed ✓`;
    else                                    achievement = `Story ${story} completed`;
    return `${type} BADGE\n${achievement}\nEarned: ${date}`;
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
        <div class="stat-item"><img src="../../assets/images/badges/gold-badge.png" alt="Gold"><span>${stats.gold}</span></div>
        <div class="stat-item"><img src="../../assets/images/badges/silver-badge.png" alt="Silver"><span>${stats.silver}</span></div>
        <div class="stat-item"><img src="../../assets/images/badges/bronze-badge.png" alt="Bronze"><span>${stats.bronze}</span></div>
        <div class="stat-total">Total: ${stats.total} badges</div>
    `;
}

function showEmptyState(container) {
    container.innerHTML = `
        <div class="empty-state" style="display:flex;flex-direction:column;align-items:center;width:100%">
            <img src="../../assets/images/badges/locked-badge.png" alt="No badges" style="width:120px;opacity:0.5">
            <div style="background:rgba(255,255,255,0.82);backdrop-filter:blur(6px);border-radius:24px;padding:18px 32px;margin:12px auto 0;max-width:600px;width:100%;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,0.08)">
                <h3 style="color:#7B3F00;font-size:2rem;font-weight:800;margin:0 0 10px;line-height:1.3">No Badges Yet!</h3>
                <p style="color:#5a3a1a;font-size:1.8rem;font-weight:600;margin:0;line-height:1.6;text-align:justify;text-align-last:center">Complete stories and quizzes to earn your first badge.</p>
            </div>
            <button class="start-button header-font font-extrabold" onclick="goToLibrary()"
                style="margin-top:50px;width:100%;max-width:320px;color:#fff;font-size:1.8rem;padding:20px 32px;border-radius:40px;border:3px solid #FF6B35;cursor:pointer;background:linear-gradient(180deg,#FFB74D 0%,#FF9800 100%);box-shadow:0 6px 0 #E65100,0 10px 15px rgba(0,0,0,0.2);min-height:80px;display:flex;align-items:center;justify-content:center;white-space:nowrap">
                Start Reading
            </button>
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

function closeBadgeModal() {
    const modal = document.querySelector('.badge-modal');
    if (modal) modal.remove();
}

function goToLibrary() {
    window.location.href = 'library.html';
}

window.addEventListener('DOMContentLoaded', loadBadges);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeBadgeModal();
});
