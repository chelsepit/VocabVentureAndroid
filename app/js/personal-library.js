// personal-library.js - Personal Library with Progress Tracking and Resume Functionality

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
let storiesIndexData = {}; // Store stories index for cover images

// ============================================
// LOAD STORIES INDEX
// ============================================
async function loadStoriesIndex() {
    try {
        const response = await fetch('../../data/stories-index.json');
        const data = await response.json();
        
        // Create a mapping of story ID to cover image path
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
    
    // Story completion: 0-50% (gradual increase based on segments)
    if (status.storyCompleted) {
        // All segments complete = 50%
        progress += 50;
    } else {
        // Gradual progress based on segments completed
        // Example: 7 out of 13 segments = (7/13) * 50 = 26.9%
        const segmentProgress = (status.completedSegments / status.totalSegments) * 50;
        progress += segmentProgress;
    }
    
    // Quiz 1: 25%
    if (status.quiz1Completed) {
        progress += 25;
    }
    
    // Quiz 2: 25%
    if (status.quiz2Completed) {
        progress += 25;
    }
    
    return Math.round(progress);
}

// Get total segments for each story
function getTotalSegments(storyId) {
    const segments = {
        1: 13,  // How the Tinguian Learned to Plant
        2: 14,  // Story 2
        3: 10,  // The Butterfly & The Caterpillar
        // Add more stories as needed
    };
    return segments[storyId] || 14; // Default to 14 segments
}

// ============================================
// LOAD USER PROGRESS
// ============================================
async function loadProgress() {
    try {
        console.log('Loading progress for user:', currentUser.id);
        
        // Get progress for each active story (1-30)
        for (let storyId = 1; storyId <= 30; storyId++) {
            try {
                const totalSegments = getTotalSegments(storyId);
                
                // Get comprehensive story status
                const status = await ipcRenderer.invoke('story:getCompletionStatus', {
                    userId: currentUser.id,
                    storyId: storyId,
                    totalSegments: totalSegments
                });
                
                // Calculate progress percentage (50% story, 25% quiz1, 25% quiz2)
                const percentage = calculateProgressPercentage(status);
                
                // Store in memory
                userProgressData[storyId] = {
                    percentage: percentage,
                    status: status,
                    lastAccessed: status.lastAccessed || null
                };
                
                console.log(`Story ${storyId}: ${percentage}% (Story: ${status.storyCompleted ? '✓' : status.completedSegments + '/' + totalSegments}, Quiz1: ${status.quiz1Completed ? '✓' : '✗'}, Quiz2: ${status.quiz2Completed ? '✓' : '✗'})`);
                
            } catch (err) {
                // If error, set to 0% for this story
                userProgressData[storyId] = {
                    percentage: 0,
                    status: null,
                    lastAccessed: null
                };
                console.log(`Could not load progress for story ${storyId}:`, err.message);
            }
        }
        
        // Organize books into categories
        await organizeBooks();
        
    } catch (error) {
        console.error('Error loading progress:', error);
    }
}

// ============================================
// GET BOOK IMAGE PATH FOR STORY
// ============================================
function getBookImagePath(storyId) {
    // Get image from stories index if available
    if (storiesIndexData[storyId] && storiesIndexData[storyId].coverImage) {
        return '../../' + storiesIndexData[storyId].coverImage;
    }
    
    // Fallback if story not found
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
// ORGANIZE BOOKS INTO CATEGORIES
// ============================================
async function organizeBooks() {
    recentReadsData = [];
    completedBooksData = [];
    
    // Categorize based on progress data
    Object.keys(userProgressData).forEach(storyId => {
        const data = userProgressData[storyId];
        const percentage = data.percentage;
        
        // Create book element dynamically
        const bookElement = createBookElement(storyId);
        
        // Create book data object
        const bookData = {
            storyId: parseInt(storyId),
            element: bookElement,
            percentage: percentage,
            lastAccessed: data.lastAccessed,
            isCompleted: percentage === 100
        };
        
        // Categorize
        if (percentage === 100) {
            completedBooksData.push(bookData);
        } else if (percentage > 0) {
            recentReadsData.push(bookData);
        }
    });
    
    // Sort recent reads by last accessed (most recent first)
    recentReadsData.sort((a, b) => {
        if (!a.lastAccessed) return 1;
        if (!b.lastAccessed) return -1;
        return new Date(b.lastAccessed) - new Date(a.lastAccessed);
    });
    
    // Sort completed books by completion date
    completedBooksData.sort((a, b) => {
        if (!a.lastAccessed) return 1;
        if (!b.lastAccessed) return -1;
        return new Date(b.lastAccessed) - new Date(a.lastAccessed);
    });
    
    // Render the organized books
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
    
    // Clear containers
    recentReadsContainer.innerHTML = '';
    completedBooksContainer.innerHTML = '';
    
    // Populate Recent Reads
    if (recentReadsData.length > 0) {
        recentReadsData.forEach(bookData => {
            const bookElement = bookData.element;
            
            // Update progress bar
            const progressBar = bookElement.querySelector('.progress-fill');
            if (progressBar) {
                progressBar.style.width = bookData.percentage + '%';
                progressBar.setAttribute('data-progress', bookData.storyId);
                
                // Color coding
                if (bookData.percentage >= 50) {
                    progressBar.style.background = 'linear-gradient(to right, #fbbf24, #f59e0b)'; // Yellow
                } else {
                    progressBar.style.background = 'linear-gradient(to right, #60a5fa, #3b82f6)'; // Blue
                }
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
            
            // Update progress bar to 100%
            const progressBar = bookElement.querySelector('.progress-fill');
            if (progressBar) {
                progressBar.style.width = '100%';
                progressBar.setAttribute('data-progress', bookData.storyId);
                progressBar.style.background = 'linear-gradient(to right, #4ade80, #22c55e)'; // Green
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
    
    // Attach click handlers to all books
    attachBookClickHandlers();
}


// ============================================
// RESUME STORY - Routes to correct page based on quiz progress
// ============================================
async function resumeToCorrectPage(storyId, userId) {
    try {
        const totalSegments = getTotalSegments(storyId);

        const status = await ipcRenderer.invoke('story:getCompletionStatus', {
            userId: userId,
            storyId: storyId,
            totalSegments: totalSegments
        });

        console.log(`Resume status for story ${storyId}:`, status);

        if (!status.storyCompleted) {
            // Story not finished — go to story viewer (modal will handle resume)
            window.location.href = `story-viewer.html?id=${storyId}`;
        } else if (!status.quiz1Completed) {
            // Story done, quiz 1 not started — go to pick-a-word
            sessionStorage.setItem('quizStoryId', storyId);
            window.location.href = `pick-a-word.html?story=${storyId}`;
        } else if (!status.quiz2Completed) {
            // Quiz 1 done, quiz 2 not started — go to decode-the-word
            sessionStorage.setItem('quizStoryId', storyId);
            window.location.href = `decode-the-word.html?story=${storyId}`;
        } else {
            // All done — go back to story (modal will handle resume)
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
        // Remove existing listeners by cloning
        const newBook = book.cloneNode(true);
        book.parentNode.replaceChild(newBook, book);
        
        // Add click handler
        newBook.addEventListener('click', async () => {
            const storyId = parseInt(newBook.dataset.storyId);
            
            if (!storyId) {
                console.error('No story ID found');
                return;
            }
            
            console.log(`Opening story ${storyId}`);
            await resumeToCorrectPage(storyId, userId);
        });
        
        // Add hover effects
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
// INITIALIZE ON PAGE LOAD
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Personal Library loaded');
    
    // Load stories index first, then load progress bars from database
    await loadStoriesIndex();
    await loadProgress();
});