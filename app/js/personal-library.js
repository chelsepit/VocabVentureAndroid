// personal-library.js - Personal Library with Progress Tracking and Resume Functionality
// OPTIMIZED: Parallel IPC calls + immediate image render before progress loads

const { ipcRenderer } = require('electron');

// Check authentication
const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser) {
    window.location.href = '../auth/login.html';
}

// Store progress data
let userProgressData = {};
let recentReadsData = [];
let completedBooksData = [];
let storiesIndexData = {};

// ============================================
// LOAD STORIES INDEX
// ============================================
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
        
        console.log('Stories index loaded:', storiesIndexData);
    } catch (error) {
        console.error('Error loading stories index:', error);
    }
}

// ============================================
// CALCULATE PROGRESS PERCENTAGE
// ============================================
function calculateProgressPercentage(status) {
    let progress = 0;
    
    if (status.storyCompleted) {
        progress += 50;
    } else {
        const segmentProgress = (status.completedSegments / status.totalSegments) * 50;
        progress += segmentProgress;
    }
    
    if (status.quiz1Completed) {
        progress += 25;
    }
    
    if (status.quiz2Completed) {
        progress += 25;
    }
    
    return Math.round(progress);
}

// Get total segments for each story
function getTotalSegments(storyId) {
    const segments = {
        1: 13,
        2: 14,
        3: 10,
    };
    return segments[storyId] || 14;
}

// ============================================
// LOAD USER PROGRESS - ALL IN PARALLEL
// ============================================
async function loadProgress() {
    try {
        console.log('Loading progress for user:', currentUser.id);
        
        // ⚡ Fire ALL 30 IPC calls at once instead of one-by-one
        const storyIds = Array.from({ length: 30 }, (_, i) => i + 1);
        
        const progressPromises = storyIds.map(async (storyId) => {
            try {
                const totalSegments = getTotalSegments(storyId);
                const status = await ipcRenderer.invoke('story:getCompletionStatus', {
                    userId: currentUser.id,
                    storyId: storyId,
                    totalSegments: totalSegments
                });
                const percentage = calculateProgressPercentage(status);
                return { storyId, percentage, status };
            } catch (err) {
                return { storyId, percentage: 0, status: null };
            }
        });
        
        // Wait for all to resolve simultaneously
        const results = await Promise.all(progressPromises);
        
        results.forEach(({ storyId, percentage, status }) => {
            userProgressData[storyId] = {
                percentage,
                status,
                lastAccessed: status?.lastAccessed || null
            };
        });
        
        // Now organize and update the progress bars on already-rendered books
        await organizeAndUpdateBooks();
        
    } catch (error) {
        console.error('Error loading progress:', error);
    }
}

// ============================================
// GET BOOK IMAGE PATH FOR STORY
// ============================================
function getBookImagePath(storyId) {
    if (storiesIndexData[storyId] && storiesIndexData[storyId].coverImage) {
        return '../../' + storiesIndexData[storyId].coverImage;
    }
    console.warn(`No cover image found for story ${storyId}`);
    return '../../assets/images/books/default-book.png';
}

// ============================================
// CREATE BOOK ELEMENT
// ============================================
function createBookElement(storyId) {
    const bookDiv = document.createElement('div');
    bookDiv.className = 'book-item';
    bookDiv.dataset.storyId = storyId;
    
    const img = document.createElement('img');
    img.src = getBookImagePath(storyId);
    img.alt = `Book ${storyId}`;
    // ⚡ Decode async so layout doesn't block on the image
    img.decoding = 'async';
    
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

// ============================================
// RENDER BOOKS IMMEDIATELY (no progress yet)
// ============================================
function renderBooksImmediately() {
    const recentReadsContainer = document.getElementById('recentReads');
    const completedBooksContainer = document.getElementById('completedBooks');
    
    if (!recentReadsContainer || !completedBooksContainer) return;
    
    // ⚡ Show skeleton/placeholder state right away so user sees something instantly
    recentReadsContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px;">
            <p style="color: #6b7280; font-size: 1.1rem;">Loading your books...</p>
        </div>
    `;
    completedBooksContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px;">
            <p style="color: #6b7280; font-size: 1.1rem;">Loading...</p>
        </div>
    `;
}

// ============================================
// ORGANIZE BOOKS AND UPDATE PROGRESS BARS
// ============================================
async function organizeAndUpdateBooks() {
    recentReadsData = [];
    completedBooksData = [];
    
    Object.keys(userProgressData).forEach(storyId => {
        const data = userProgressData[storyId];
        const percentage = data.percentage;
        
        if (percentage === 0) return; // Skip untouched books entirely
        
        const bookElement = createBookElement(storyId);
        
        const bookData = {
            storyId: parseInt(storyId),
            element: bookElement,
            percentage,
            lastAccessed: data.lastAccessed,
            isCompleted: percentage === 100
        };
        
        if (percentage === 100) {
            completedBooksData.push(bookData);
        } else {
            recentReadsData.push(bookData);
        }
    });
    
    // Sort recent reads by last accessed (most recent first)
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

// ============================================
// RENDER ORGANIZED BOOKS
// ============================================
function renderOrganizedBooks() {
    const recentReadsContainer = document.getElementById('recentReads');
    const completedBooksContainer = document.getElementById('completedBooks');
    
    if (!recentReadsContainer || !completedBooksContainer) {
        console.error('Book containers not found');
        return;
    }
    
    recentReadsContainer.innerHTML = '';
    completedBooksContainer.innerHTML = '';
    
    // Populate Recent Reads
    if (recentReadsData.length > 0) {
        recentReadsData.forEach(bookData => {
            const bookElement = bookData.element;
            const progressBar = bookElement.querySelector('.progress-fill');
            if (progressBar) {
                progressBar.style.width = bookData.percentage + '%';
                progressBar.setAttribute('data-progress', bookData.storyId);
                progressBar.style.background = bookData.percentage >= 50
                    ? 'linear-gradient(to right, #fbbf24, #f59e0b)'
                    : 'linear-gradient(to right, #60a5fa, #3b82f6)';
            }
            recentReadsContainer.appendChild(bookElement);
        });
    } else {
        recentReadsContainer.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <p style="color: #6b7280; font-size: 1.1rem;">No books in progress yet!</p>
                <p style="color: #9ca3af; font-size: 0.9rem; margin-top: 10px;">Start reading from the Library</p>
            </div>
        `;
    }
    
    // Populate Completed Books
    if (completedBooksData.length > 0) {
        completedBooksData.forEach(bookData => {
            const bookElement = bookData.element;
            const progressBar = bookElement.querySelector('.progress-fill');
            if (progressBar) {
                progressBar.style.width = '100%';
                progressBar.setAttribute('data-progress', bookData.storyId);
                progressBar.style.background = 'linear-gradient(to right, #4ade80, #22c55e)';
            }
            completedBooksContainer.appendChild(bookElement);
        });
    } else {
        completedBooksContainer.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <p style="color: #6b7280; font-size: 1.1rem;">No completed books yet!</p>
                <p style="color: #9ca3af; font-size: 0.9rem; margin-top: 10px;">Finish stories to see them here</p>
            </div>
        `;
    }
    
    attachBookClickHandlers();
}

// ============================================
// RESUME STORY - Routes to correct page based on quiz progress
// ============================================
async function resumeToCorrectPage(storyId, userId) {
    try {
        const totalSegments = getTotalSegments(storyId);
        const status = await ipcRenderer.invoke('story:getCompletionStatus', {
            userId,
            storyId,
            totalSegments
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
    } catch (error) {
        console.error('Error resuming story:', error);
        window.location.href = `story-viewer.html?id=${storyId}`;
    }
}

// ============================================
// ATTACH BOOK CLICK HANDLERS
// ============================================
function attachBookClickHandlers() {
    const allBooks = document.querySelectorAll('.book-item[data-story-id]');
    const userId = currentUser?.id || parseInt(localStorage.getItem('lastUserId'));
    
    allBooks.forEach(book => {
        const newBook = book.cloneNode(true);
        book.parentNode.replaceChild(newBook, book);
        
        newBook.addEventListener('click', async () => {
            const storyId = parseInt(newBook.dataset.storyId);
            if (!storyId) return;
            await resumeToCorrectPage(storyId, userId);
        });
        
        newBook.style.cursor = 'pointer';
        newBook.addEventListener('mouseenter', () => {
            newBook.style.transform = 'translateY(-5px)';
            newBook.style.transition = 'transform 0.3s ease';
        });
        newBook.addEventListener('mouseleave', () => {
            newBook.style.transform = 'translateY(0)';
        });
    });
}

// ============================================
// PRELOAD COVER IMAGES
// ============================================
function preloadCoverImages() {
    // ⚡ Start fetching all cover images from storiesIndex immediately
    // so they're in the browser cache before we need to display them
    Object.values(storiesIndexData).forEach(story => {
        if (story.coverImage) {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = '../../' + story.coverImage;
            document.head.appendChild(link);
        }
    });
}

// ============================================
// INITIALIZE ON PAGE LOAD
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Personal Library loaded');
    
    // ⚡ Show loading state immediately
    renderBooksImmediately();
    
    // ⚡ Load stories index and preload images first
    await loadStoriesIndex();
    preloadCoverImages();
    
    // ⚡ Then fire all 30 IPC progress queries in parallel
    await loadProgress();
});