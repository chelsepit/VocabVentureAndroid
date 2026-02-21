// personal-library.js — Capacitor/Android version
// REMOVED: const { ipcRenderer } = require('electron')
// REPLACED: ipcRenderer.invoke → direct db calls

import { db } from './db/db-interface.js';

const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser) {
    window.location.href = '../auth/login.html';
}

let userProgressData = {};
let recentReadsData = [];
let completedBooksData = [];
let storiesIndexData = {};

// CHANGED: was fetch (already fine — no IPC)
async function loadStoriesIndex() {
    try {
        const response = await fetch('../../data/stories-index.json');
        const data = await response.json();
        data.stories.forEach(story => {
            storiesIndexData[story.id] = {
                title: story.title,
                genre: story.genre,
                coverImage: story.coverImage
            };
        });
    } catch (error) {
        console.error('Error loading stories index:', error);
    }
}

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

// CHANGED: was ipcRenderer.invoke('story:getCompletionStatus', ...)
async function loadProgress() {
    try {
        for (let storyId = 1; storyId <= 30; storyId++) {
            try {
                const totalSegments = getTotalSegments(storyId);
                const status = await db.getStoryCompletionStatus(currentUser.id, storyId, totalSegments);
                const percentage = calculateProgressPercentage(status);
                userProgressData[storyId] = {
                    percentage,
                    status,
                    lastAccessed: status.lastAccessed || null
                };
            } catch (err) {
                userProgressData[storyId] = { percentage: 0, status: null, lastAccessed: null };
            }
        }
        await organizeBooks();
    } catch (error) {
        console.error('Error loading progress:', error);
    }
}

function getBookImagePath(storyId) {
    if (storiesIndexData[storyId]?.coverImage) {
        return '../../' + storiesIndexData[storyId].coverImage;
    }
    return '../../assets/images/books/default-book.png';
}

function createBookElement(storyId) {
    const bookDiv = document.createElement('div');
    bookDiv.className = 'book-item';
    bookDiv.dataset.storyId = storyId;

    const img = document.createElement('img');
    img.src = getBookImagePath(storyId);
    img.alt = `Book ${storyId}`;

    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';

    const progressFill = document.createElement('div');
    progressFill.className = 'progress-fill';
    progressFill.style.width = '0%';
    progressFill.dataset.progress = storyId;

    progressContainer.appendChild(progressFill);
    bookDiv.appendChild(img);
    bookDiv.appendChild(progressContainer);
    return bookDiv;
}

async function organizeBooks() {
    recentReadsData = [];
    completedBooksData = [];

    Object.keys(userProgressData).forEach(storyId => {
        const data = userProgressData[storyId];
        const bookElement = createBookElement(storyId);
        const bookData = {
            storyId: parseInt(storyId),
            element: bookElement,
            percentage: data.percentage,
            lastAccessed: data.lastAccessed,
            isCompleted: data.percentage === 100
        };
        if (data.percentage === 100) {
            completedBooksData.push(bookData);
        } else if (data.percentage > 0) {
            recentReadsData.push(bookData);
        }
    });

    recentReadsData.sort((a, b) => {
        if (!a.lastAccessed) return 1;
        if (!b.lastAccessed) return -1;
        return new Date(b.lastAccessed) - new Date(a.lastAccessed);
    });

    completedBooksData.sort((a, b) => {
        if (!a.lastAccessed) return 1;
        if (!b.lastAccessed) return -1;
        return new Date(b.lastAccessed) - new Date(a.lastAccessed);
    });

    renderOrganizedBooks();
}

function renderOrganizedBooks() {
    const recentReadsContainer    = document.getElementById('recentReads');
    const completedBooksContainer = document.getElementById('completedBooks');
    if (!recentReadsContainer || !completedBooksContainer) return;

    recentReadsContainer.innerHTML    = '';
    completedBooksContainer.innerHTML = '';

    if (recentReadsData.length > 0) {
        recentReadsData.forEach(bookData => {
            const pb = bookData.element.querySelector('.progress-fill');
            if (pb) {
                pb.style.width = bookData.percentage + '%';
                pb.style.background = bookData.percentage >= 50
                    ? 'linear-gradient(to right, #fbbf24, #f59e0b)'
                    : 'linear-gradient(to right, #60a5fa, #3b82f6)';
            }
            recentReadsContainer.appendChild(bookData.element);
        });
    } else {
        recentReadsContainer.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;text-align:center;padding:40px;">
                <p style="color:#6b7280;font-size:1.1rem;">No books in progress yet!</p>
                <p style="color:#9ca3af;font-size:0.9rem;margin-top:10px;">Start reading from the Library</p>
            </div>`;
    }

    if (completedBooksData.length > 0) {
        completedBooksData.forEach(bookData => {
            const pb = bookData.element.querySelector('.progress-fill');
            if (pb) {
                pb.style.width = '100%';
                pb.style.background = 'linear-gradient(to right, #4ade80, #22c55e)';
            }
            completedBooksContainer.appendChild(bookData.element);
        });
    } else {
        completedBooksContainer.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;text-align:center;padding:40px;">
                <p style="color:#6b7280;font-size:1.1rem;">No completed books yet!</p>
                <p style="color:#9ca3af;font-size:0.9rem;margin-top:10px;">Finish stories to see them here</p>
            </div>`;
    }

    attachBookClickHandlers();
}

// CHANGED: was ipcRenderer.invoke('progress:getLastViewed', ...)
function attachBookClickHandlers() {
    document.querySelectorAll('.book-item[data-story-id]').forEach(book => {
        const newBook = book.cloneNode(true);
        book.parentNode.replaceChild(newBook, book);

        newBook.addEventListener('click', async () => {
            const storyId = parseInt(newBook.dataset.storyId);
            if (!storyId) return;
            try {
                const lastSegment = await db.getLastViewedSegment(currentUser.id, storyId);
                if (lastSegment > 0) {
                    window.location.href = `story-viewer.html?id=${storyId}&segment=${lastSegment}`;
                } else {
                    window.location.href = `story-viewer.html?id=${storyId}`;
                }
            } catch (error) {
                window.location.href = `story-viewer.html?id=${storyId}`;
            }
        });

        newBook.style.cursor = 'pointer';
        newBook.addEventListener('mouseenter', () => { newBook.style.transform = 'translateY(-5px)'; newBook.style.transition = 'transform 0.3s ease'; });
        newBook.addEventListener('mouseleave', () => { newBook.style.transform = 'translateY(0)'; });
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadStoriesIndex();
    await loadProgress();
});
