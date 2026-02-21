// personal-library.js - Personal Library with Progress Tracking
// Uses bridge.js instead of ipcRenderer — works on Electron AND Android.

const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser) window.location.href = '../auth/login.html';

let userProgressData = {};
let recentReadsData  = [];
let completedBooksData = [];
let storiesIndexData = {};

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

async function loadProgress() {
    try {
        for (let storyId = 1; storyId <= 30; storyId++) {
            try {
                const totalSegments = getTotalSegments(storyId);
                const status = await bridge.invoke('story:getCompletionStatus', {
                    userId: currentUser.id,
                    storyId,
                    totalSegments
                });
                userProgressData[storyId] = {
                    percentage: calculateProgressPercentage(status),
                    status,
                    lastAccessed: status.lastAccessed || null
                };
            } catch (_) {
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
    recentReadsData   = [];
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

        if (data.percentage === 100)     completedBooksData.push(bookData);
        else if (data.percentage > 0)    recentReadsData.push(bookData);
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
    const recentContainer    = document.getElementById('recentReads');
    const completedContainer = document.getElementById('completedBooks');
    if (!recentContainer || !completedContainer) return;

    recentContainer.innerHTML    = '';
    completedContainer.innerHTML = '';

    if (recentReadsData.length > 0) {
        recentReadsData.forEach(bookData => {
            const bar = bookData.element.querySelector('.progress-fill');
            if (bar) {
                bar.style.width = bookData.percentage + '%';
                bar.style.background = bookData.percentage >= 50
                    ? 'linear-gradient(to right, #fbbf24, #f59e0b)'
                    : 'linear-gradient(to right, #60a5fa, #3b82f6)';
            }
            recentContainer.appendChild(bookData.element);
        });
    } else {
        recentContainer.innerHTML = `<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:40px"><p style="color:#6b7280;font-size:1.1rem">No books in progress yet!</p><p style="color:#9ca3af;font-size:0.9rem;margin-top:10px">Start reading from the Library</p></div>`;
    }

    if (completedBooksData.length > 0) {
        completedBooksData.forEach(bookData => {
            const bar = bookData.element.querySelector('.progress-fill');
            if (bar) {
                bar.style.width = '100%';
                bar.style.background = 'linear-gradient(to right, #4ade80, #22c55e)';
            }
            completedContainer.appendChild(bookData.element);
        });
    } else {
        completedContainer.innerHTML = `<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:40px"><p style="color:#6b7280;font-size:1.1rem">No completed books yet!</p><p style="color:#9ca3af;font-size:0.9rem;margin-top:10px">Finish stories to see them here</p></div>`;
    }

    attachBookClickHandlers();
}

async function resumeToCorrectPage(storyId, userId) {
    try {
        const status = await bridge.invoke('story:getCompletionStatus', {
            userId,
            storyId,
            totalSegments: getTotalSegments(storyId)
        });

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

function attachBookClickHandlers() {
    const userId = currentUser?.id || parseInt(localStorage.getItem('lastUserId'));
    document.querySelectorAll('.book-item[data-story-id]').forEach(book => {
        const newBook = book.cloneNode(true);
        book.parentNode.replaceChild(newBook, book);

        newBook.addEventListener('click', async () => {
            const storyId = parseInt(newBook.dataset.storyId);
            if (!storyId) return;
            await resumeToCorrectPage(storyId, userId);
        });

        newBook.style.cursor = 'pointer';
        newBook.addEventListener('mouseenter', () => { newBook.style.transform = 'translateY(-5px)'; newBook.style.transition = 'transform 0.3s ease'; });
        newBook.addEventListener('mouseleave', () => { newBook.style.transform = 'translateY(0)'; });
    });
}

document.addEventListener('DOMContentLoaded', async function () {
    await loadStoriesIndex();
    await loadProgress();
});
