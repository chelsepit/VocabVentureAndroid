// library.js - Library Page with WORKING SEARCH

const { ipcRenderer } = require('electron');

// Check authentication
const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser) {
    window.location.href = '../auth/login.html';
}

// Store progress data to persist across genre switches
let userProgressData = {};
let allStories = []; // Store all stories globally for search
let currentGenre = 'folktales'; // Track current genre

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

// ============================================
// LOAD USER PROGRESS
// ============================================
async function loadProgress() {
    try {
        console.log('Loading progress for user:', currentUser.id);
        
        for (let storyId = 1; storyId <= 30; storyId++) {
            try {
                const totalSegments = getTotalSegments(storyId);
                
                const status = await ipcRenderer.invoke('story:getCompletionStatus', {
                    userId: currentUser.id,
                    storyId: storyId,
                    totalSegments: totalSegments
                });
                
                const percentage = calculateProgressPercentage(status);
                userProgressData[storyId] = percentage;
                
                console.log(`Story ${storyId}: ${percentage}% (Story: ${status.storyCompleted ? '✓' : status.completedSegments + '/' + totalSegments}, Quiz1: ${status.quiz1Completed ? '✓' : '✗'}, Quiz2: ${status.quiz2Completed ? '✓' : '✗'})`);
                
            } catch (err) {
                userProgressData[storyId] = 0;
                console.log(`Could not load progress for story ${storyId}:`, err.message);
            }
        }
        
        applyProgressBars();
        
    } catch (error) {
        console.error('Error loading progress:', error);
    }
}

// ============================================
// APPLY PROGRESS BARS
// ============================================
function applyProgressBars() {
    Object.keys(userProgressData).forEach(storyId => {
        const percentage = userProgressData[storyId];
        const progressBars = document.querySelectorAll(`[data-progress="${storyId}"]`);
        
        if (progressBars.length > 0) {
            progressBars.forEach(bar => {
                bar.style.width = percentage + '%';
                
                if (percentage === 100) {
                    bar.style.background = 'linear-gradient(to right, #4ade80, #22c55e)';
                } else if (percentage >= 50) {
                    bar.style.background = 'linear-gradient(to right, #fbbf24, #f59e0b)';
                } else if (percentage > 0) {
                    bar.style.background = 'linear-gradient(to right, #60a5fa, #3b82f6)';
                } else {
                    bar.style.width = '0%';
                }
            });
        }
    });
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
// GENRE FILTERING & SEARCH
// ============================================
(() => {
    const DATA_PATH = "../../data/stories-index.json";
    const libraryContainer = document.getElementById("libraryContent");
    const genreTags = document.querySelectorAll(".genre-tag");

    if (!libraryContainer) {
        console.error("libraryContent container not found");
        return;
    }

    // Load JSON
    fetch(DATA_PATH)
        .then(res => {
            if (!res.ok) throw new Error('Failed to fetch stories index');
            return res.json();
        })
        .then(data => {
            allStories = data.stories;
            
            // Initially show folktales
            const folktales = allStories.filter(s => s.genre === 'folktales');
            renderLibrary(folktales);
            
            // Load user progress
            loadProgress();
        })
        .catch(err => console.error("Failed to load stories:", err));

    // Render shelves
    function renderLibrary(stories) {
        libraryContainer.innerHTML = "";

        if (stories.length === 0) {
            libraryContainer.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <h2 style="color: #000000; font-size: 1.5rem; margin-bottom: 10px;">No stories found</h2>
                    <p style="color: #000000; font-size: 1rem;">Try a different search term or genre</p>
                </div>
            `;
            return;
        }

        const grouped = groupByGenre(stories);

        Object.keys(grouped).forEach(genre => {
            const section = document.createElement("section");
            section.className = "bookshelf-section";

            section.innerHTML = `
                <div class="section-header">
                    <h2 class="section-title">${formatGenre(genre)}</h2>
                </div>
                <div class="book-grid">
                    ${grouped[genre].map(renderBook).join("")}
                </div>
            `;

            libraryContainer.appendChild(section);
        });
        
        attachBookClicks();
        applyProgressBars();
    }

    // Render single book
    function renderBook(story) {
        const locked = !story.isActive;
        
        return `
            <div class="book-item ${locked ? "locked" : ""}"
                 data-id="${story.id}"
                 data-active="${story.isActive}"
                 data-title="${story.title}"
                 data-story-id="${story.id}">
             
                <div class="book-cover-wrapper">
                    <img 
                        src="../../${story.coverImage}" 
                        alt="${story.title}"
                        onload="this.closest('.book-item').querySelector('.progress-container').style.opacity='1'"
                    >
                    ${locked ? `<div class="coming-soon">Coming Soon</div>` : ""}
                </div>
                <div class="progress-container" style="opacity: 0; transition: opacity 0.3s ease;">
                    <div class="progress-fill" style="width: 0%;" data-progress="${story.id}"></div>
                </div>
            </div>
        `;
    }

    // Group by genre
    function groupByGenre(stories) {
        return stories.reduce((acc, story) => {
            if (!acc[story.genre]) acc[story.genre] = [];
            acc[story.genre].push(story);
            return acc;
        }, {});
    }

    // Genre button filtering
    genreTags.forEach(tag => {
        tag.addEventListener("click", () => {
            genreTags.forEach(t => t.classList.remove("active"));
            tag.classList.add("active");

            currentGenre = tag.dataset.genre;
            
            // Clear search when switching genres
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = '';
            }
            
            const filtered = allStories.filter(s => s.genre === currentGenre);
            renderLibrary(filtered);
        });
    });

    // Helper
    function formatGenre(genre) {
        return genre
            .replace(/-/g, " ")
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    // Make renderLibrary accessible globally for search
    window.renderLibrarySearch = renderLibrary;
})();

// ============================================
// SEARCH FUNCTIONALITY
// ============================================
const searchInput = document.getElementById('searchInput');
const clearSearch = document.getElementById('clearSearch');

if (searchInput && clearSearch) {
    // Search as user types
    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();
        console.log('Search query:', query);
        
        // Show/hide clear button
        clearSearch.style.opacity = query ? '1' : '0.7';
        
        // Perform search
        performSearch(query);
    });

    // Clear search
    clearSearch.addEventListener('click', function() {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        searchInput.focus();
    });
}

// ⭐ NEW: Perform search
function performSearch(query) {
    if (!query) {
        // No search query - show current genre
        const filtered = allStories.filter(s => s.genre === currentGenre);
        window.renderLibrarySearch(filtered);
        return;
    }
    
    // Search across ALL stories (all genres)
    const results = allStories.filter(story => {
        const titleMatch = story.title.toLowerCase().includes(query);
        const genreMatch = story.genre.toLowerCase().includes(query);
        const cultureMatch = story.culture && story.culture.toLowerCase().includes(query);
        
        return titleMatch || genreMatch || cultureMatch;
    });
    
    console.log(`Found ${results.length} results for "${query}"`);
    
    // Render search results
    window.renderLibrarySearch(results);
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
            // Always open the story viewer without forcing a segment.
            // The story viewer itself will show the resume modal and handle Continue/Start Over.
            window.location.href = `story-viewer.html?id=${storyId}`;
        } else if (!status.quiz1Completed) {
            sessionStorage.setItem('quizStoryId', storyId);
            window.location.href = `pick-a-word.html?story=${storyId}`;
        } else if (!status.quiz2Completed) {
            sessionStorage.setItem('quizStoryId', storyId);
            window.location.href = `decode-the-word.html?story=${storyId}`;
        } else {
            // All done — go back to story viewer. No resume modal needed, but opening normally is fine.
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
function attachBookClicks() {
    document.querySelectorAll(".book-item").forEach(book => {
        book.addEventListener("click", async () => {
            const isActive = book.dataset.active === "true";
            const id = parseInt(book.dataset.id);
            const title = book.dataset.title;
            const userId = currentUser?.id || parseInt(localStorage.getItem('lastUserId'));

            if (!isActive) {
                console.log('Story not yet available:', title);
                return;
            }

            console.log(`Opening story ${id}: ${title}`);
            await resumeToCorrectPage(id, userId);
        });
        
        // Add hover effect for active books
        if (book.dataset.active === "true") {
            book.style.cursor = "pointer";
            
            book.addEventListener("mouseenter", () => {
                book.style.transform = "translateY(-5px)";
                book.style.transition = "transform 0.3s ease";
            });
            
            book.addEventListener("mouseleave", () => {
                book.style.transform = "translateY(0)";
            });
        }
    });
}
