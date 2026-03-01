// library.js - Library Page with Search
// Fixed for Capacitor/Android: replaced bridge.invoke → db calls

import { db } from './db/db-interface.js';   // ✅ FIX #1 & #2: Import db (was missing entirely)

const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser) window.location.href = '../auth/login.html';

let userProgressData = {};
let allStories = [];
let currentGenre = 'folktales';

function calculateProgressPercentage(status) {
    let progress = 0;
    if (status.storyCompleted) {
        progress += 50;
    } else {
        progress += (status.completedSegments / status.totalSegments) * 50;
    }
    if (status.quiz1Completed) progress += 25;
    if (status.quiz2Completed) progress += 25;
    return Math.round(progress);
}

function getTotalSegments(storyId) {
    const segments = { 1: 13, 2: 14, 3: 10 };
    return segments[storyId] || 14;
}

async function loadProgress() {
    try {
        // ⚡ OPTIMIZED: 3 bulk queries instead of 90 individual ones
        const { progressMap, badgeMap } = await db.getAllStoriesCompletionStatus(currentUser.id);

        for (let storyId = 1; storyId <= 30; storyId++) {
            const totalSegments = getTotalSegments(storyId);
            const prog  = progressMap[storyId];
            const badge = badgeMap[storyId] ?? {};

            const completedSegments = prog?.completedSegments ?? 0;
            const storyCompleted    = completedSegments >= totalSegments;

            const status = {
                completedSegments,
                totalSegments,
                storyCompleted,
                quiz1Completed: !!badge['quiz-1'],
                quiz2Completed: !!badge['quiz-2']
            };

            userProgressData[storyId] = calculateProgressPercentage(status);
        }

        applyProgressBars();
    } catch (error) {
        console.error('Error loading progress:', error);
    }
}
function applyProgressBars() {
    Object.keys(userProgressData).forEach(storyId => {
        const percentage = userProgressData[storyId];
        document.querySelectorAll(`[data-progress="${storyId}"]`).forEach(bar => {
            // Set instantly first (no transition), then enable smooth transition
            bar.style.transition = 'none';
            bar.style.width = '0%';

            if (percentage === 100)      bar.style.background = 'linear-gradient(to right, #4ade80, #22c55e)';
            else if (percentage >= 50)   bar.style.background = 'linear-gradient(to right, #fbbf24, #f59e0b)';
            else if (percentage > 0)     bar.style.background = 'linear-gradient(to right, #60a5fa, #3b82f6)';

            // Force reflow so the transition fires properly
            bar.offsetHeight;

            // Now animate to final width
            bar.style.transition = 'width 0.4s ease';
            bar.style.width = percentage + '%';
        });
    });
}

// ── Genre filtering & search ─────────────────────────────────────────────────

(() => {
    const DATA_PATH = '../../data/stories-index.json';
    const libraryContainer = document.getElementById('libraryContent');
    const genreTags = document.querySelectorAll('.genre-tag');

    if (!libraryContainer) { console.error('libraryContent container not found'); return; }

    // ✅ FIX #3: Wait for db:ready before loading progress so DB is initialized first
    function startApp() {
        fetch(DATA_PATH)
            .then(res => { if (!res.ok) throw new Error('Failed to fetch stories index'); return res.json(); })
            .then(data => {
                allStories = data.stories;
                renderLibrary(allStories.filter(s => s.genre === 'folktales'));
                loadProgress(); // DB is guaranteed ready at this point
            })
            .catch(err => console.error('Failed to load stories:', err));
    }

    if (window.__dbReady) {
        // DB already initialized (e.g. fast device or web)
        startApp();
    } else {
        // Wait for app-init.js to signal DB is ready
        document.addEventListener('db:ready', startApp, { once: true });
    }

    function renderLibrary(stories) {
        libraryContainer.innerHTML = '';

        if (stories.length === 0) {
            libraryContainer.innerHTML = `
                <div style="text-align:center;padding:60px 20px">
                    <h2 style="color:#6e4324;font-size:1.5rem;margin-bottom:10px">No stories found</h2>
                    <p style="color:#999">Try a different search term or genre</p>
                </div>`;
            return;
        }

        const grouped = stories.reduce((acc, s) => {
            if (!acc[s.genre]) acc[s.genre] = [];
            acc[s.genre].push(s);
            return acc;
        }, {});

        Object.keys(grouped).forEach(genre => {
            const section = document.createElement('section');
            section.className = 'bookshelf-section';
            section.innerHTML = `
                <div class="section-header"><h2 class="section-title">${genre.replace(/-/g,' ').replace(/\b\w/g, l => l.toUpperCase())}</h2></div>
                <div class="book-grid">${grouped[genre].map(renderBook).join('')}</div>
            `;
            libraryContainer.appendChild(section);
        });

        attachBookClicks();
        // ✅ Apply any already-loaded progress immediately after re-render
        applyProgressBars();
    }

    function renderBook(story) {
        const locked = !story.isActive;
        return `
            <div class="book-item ${locked ? 'locked' : ''}"
                 data-id="${story.id}" data-active="${story.isActive}"
                 data-title="${story.title}" data-story-id="${story.id}">
                <div class="book-cover-wrapper">
                    <img src="../../${story.coverImage}" alt="${story.title}">
                    ${locked ? '<div class="coming-soon">Coming Soon</div>' : ''}
                </div>
                <div class="progress-container">
                    <div class="progress-fill" style="width:0%;transition:none;" data-progress="${story.id}"></div>
                </div>
            </div>`;
    }

  genreTags.forEach(tag => {
    tag.addEventListener('click', () => {
        genreTags.forEach(t => t.classList.remove('active'));
        tag.classList.add('active');
        currentGenre = tag.dataset.genre;
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';

       // Clear instantly so old bars never flash, then fade new content in
    libraryContainer.style.transition = 'none';
    libraryContainer.style.opacity = '0';
    libraryContainer.innerHTML = '';          // wipe old DOM immediately

    requestAnimationFrame(() => {
        renderLibrary(allStories.filter(s => s.genre === currentGenre));
        libraryContainer.style.transition = 'opacity 0.2s ease';
        libraryContainer.style.opacity = '1';
});
    });
});

    window.renderLibrarySearch = renderLibrary;
})();

// ── Search ───────────────────────────────────────────────────────────────────

const searchInput = document.getElementById('searchInput');
const clearSearch = document.getElementById('clearSearch');

if (searchInput && clearSearch) {
    searchInput.addEventListener('input', function () {
        const query = this.value.toLowerCase().trim();
        clearSearch.style.opacity = query ? '1' : '0.7';
        performSearch(query);
    });

    clearSearch.addEventListener('click', function () {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        searchInput.focus();
    });
}

function performSearch(query) {
    if (!query) {
        window.renderLibrarySearch(allStories.filter(s => s.genre === currentGenre));
        return;
    }
    const results = allStories.filter(s =>
        s.title.toLowerCase().includes(query) ||
        s.genre.toLowerCase().includes(query) ||
        (s.culture && s.culture.toLowerCase().includes(query))
    );
    window.renderLibrarySearch(results);
}

// ── Resume routing ────────────────────────────────────────────────────────────

async function resumeToCorrectPage(storyId, userId) {
    try {
        // ✅ FIX #1: Was bridge.invoke('story:getCompletionStatus', ...) — doesn't exist on Android
        const status = await db.getStoryCompletionStatus(userId, storyId, getTotalSegments(storyId));

        if (!status.storyCompleted) {
            window.location.href = `story-viewer.html?id=${storyId}`;
        } else if (!status.quiz1Completed) {
            sessionStorage.setItem('quizStoryId', storyId);
            window.location.href = `pick-a-word.html?story=${storyId}`;
        } else if (!status.quiz2Completed) {
            sessionStorage.setItem('quizStoryId', storyId);
            window.location.href = `decode-the-word.html?story=${storyId}`;
        } else {
            window.location.href = `story-viewer.html?id=${storyId}`;
        }
    } catch (_) {
        window.location.href = `story-viewer.html?id=${storyId}`;
    }
}

function attachBookClicks() {
    document.querySelectorAll('.book-item').forEach(book => {
        // Prevent attaching duplicate listeners on re-render
        if (book.dataset.clickAttached === 'true') return;
        book.dataset.clickAttached = 'true';

        if (book.dataset.active !== 'true') return;

        book.style.cursor = 'pointer';

        book.addEventListener('mouseenter', () => {
            book.style.transform = 'translateY(-5px)';
            book.style.transition = 'transform 0.3s ease';
        });
        book.addEventListener('mouseleave', () => {
            book.style.transform = 'translateY(0)';
        });

        book.addEventListener('click', async () => {
            // Prevent double-tap firing
            if (book.dataset.navigating === 'true') return;
            book.dataset.navigating = 'true';

            // Visual feedback
            book.style.opacity = '0.6';
            book.style.transform = 'scale(0.96)';
            book.style.transition = 'opacity 0.1s, transform 0.1s';

            const id     = parseInt(book.dataset.id);
            const userId = currentUser?.id || parseInt(localStorage.getItem('lastUserId'));
            await resumeToCorrectPage(id, userId);

            // Reset in case navigation fails
            book.dataset.navigating = 'false';
            book.style.opacity = '1';
            book.style.transform = 'translateY(0)';
        });
    });
}