// library.js - Library Page Functionality with Accurate Progress Bars

const { ipcRenderer } = require('electron');

// Check authentication
const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser) {
    window.location.href = '../auth/login.html';
}

// Store progress data to persist across genre switches
let userProgressData = {};

// ============================================
// CALCULATE PROGRESS PERCENTAGE
// ============================================
function calculateProgressPercentage(status) {
    let progress = 0;
    
    // Story completion: 50%
    if (status.storyCompleted) {
        progress += 50;
    } else {
        // Partial progress for incomplete stories
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
                
                // Store in memory for genre switching
                userProgressData[storyId] = percentage;
                
                console.log(`Story ${storyId}: ${percentage}% (Story: ${status.storyCompleted ? '✓' : status.completedSegments + '/' + totalSegments}, Quiz1: ${status.quiz1Completed ? '✓' : '✗'}, Quiz2: ${status.quiz2Completed ? '✓' : '✗'})`);
                
            } catch (err) {
                // If error, set to 0% for this story
                userProgressData[storyId] = 0;
                console.log(`Could not load progress for story ${storyId}:`, err.message);
            }
        }
        
        // Apply progress to currently visible books
        applyProgressBars();
        
    } catch (error) {
        console.error('Error loading progress:', error);
    }
}

// ============================================
// APPLY PROGRESS BARS
// ============================================
function applyProgressBars() {
    // Apply stored progress data to all visible progress bars
    Object.keys(userProgressData).forEach(storyId => {
        const percentage = userProgressData[storyId];
        const progressBars = document.querySelectorAll(`[data-progress="${storyId}"]`);
        
        if (progressBars.length > 0) {
            progressBars.forEach(bar => {
                bar.style.width = percentage + '%';
                
                // Optional: Add color coding
                if (percentage === 100) {
                    bar.style.background = 'linear-gradient(to right, #4ade80, #22c55e)'; // Green for complete
                } else if (percentage >= 50) {
                    bar.style.background = 'linear-gradient(to right, #fbbf24, #f59e0b)'; // Yellow for in progress
                } else if (percentage > 0) {
                    bar.style.background = 'linear-gradient(to right, #60a5fa, #3b82f6)'; // Blue for started
                } else {
                    bar.style.width = '0%'; // Empty for not started
                }
            });
        }
    });
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
// GENRE FILTERING
// ============================================
(() => {
    const DATA_PATH = "../../data/stories-index.json";

    const libraryContainer = document.getElementById("libraryContent");
    const genreTags = document.querySelectorAll(".genre-tag");

    if (!libraryContainer) {
        console.error("libraryContent container not found");
        return;
    }

    let allStories = [];

    // 1. Load JSON
    fetch(DATA_PATH)
        .then(res => {
            if (!res.ok) throw new Error('Failed to fetch stories index');
            return res.json();
        })
        .then(data => {
            allStories = data.stories;
            // Initially show folktales (first active genre)
            const folktales = allStories.filter(s => s.genre === 'folktales');
            renderLibrary(folktales);
            
            // Load user progress after initial render
            loadProgress();
        })
        .catch(err => console.error("Failed to load stories:", err));

    // 2. Render shelves
    function renderLibrary(stories) {
        libraryContainer.innerHTML = "";

        const grouped = groupByGenre(stories);

        Object.keys(grouped).forEach(genre => {
            const section = document.createElement("section");
            section.className = "bookshelf-section";

            section.innerHTML = `
                <div class="section-header">
                    <h2 class="section-title">${formatGenre(genre)}</h2>
                    <a href="#" class="view-all-link">view all...</a>
                </div>
                <div class="book-grid">
                    ${grouped[genre].map(renderBook).join("")}
                </div>
            `;

            libraryContainer.appendChild(section);
        });
        
        // Attach click handlers after rendering
        attachBookClicks();
        
        // Apply progress bars after rendering
        applyProgressBars();
    }

    // 3. Render single book
    function renderBook(story) {
        const locked = !story.isActive;
        
        // Set initial width to 0% for locked books, will be updated by applyProgressBars for active ones
        const initialWidth = locked ? '0%' : '0%';
        
        return `
            <div class="book-item ${locked ? "locked" : ""}"
                 data-id="${story.id}"
                 data-active="${story.isActive}"
                 data-title="${story.title}"
                 data-story-id="${story.id}">
             
                <div class="book-cover-wrapper">
                    <img src="../../${story.coverImage}" alt="${story.title}">
                    ${locked ? `<div class="coming-soon">Coming Soon</div>` : ""}
                </div>
                <div class="progress-container">
                    <div class="progress-fill" style="width: ${initialWidth};" data-progress="${story.id}"></div>
                </div>
            </div>
        `;
    }

    // 4. Group by genre
    function groupByGenre(stories) {
        return stories.reduce((acc, story) => {
            if (!acc[story.genre]) acc[story.genre] = [];
            acc[story.genre].push(story);
            return acc;
        }, {});
    }

    // 5. Genre button filtering
    genreTags.forEach(tag => {
        tag.addEventListener("click", () => {
            // Remove active class from all tags
            genreTags.forEach(t => t.classList.remove("active"));
            // Add active class to clicked tag
            tag.classList.add("active");

            const genre = tag.dataset.genre;
            const filtered = allStories.filter(s => s.genre === genre);
            
            // Re-render library
            renderLibrary(filtered);
            
            // Progress bars will be re-applied automatically by renderLibrary
        });
    });

    // 6. Helpers
    function formatGenre(genre) {
        return genre
            .replace(/-/g, " ")
            .replace(/\b\w/g, l => l.toUpperCase());
    }
})();

// ============================================
// ATTACH BOOK CLICK HANDLERS
// ============================================
function attachBookClicks() {
    document.querySelectorAll(".book-item").forEach(book => {
        book.addEventListener("click", async () => {
            const isActive = book.dataset.active === "true";
            const id = parseInt(book.dataset.id);
            const title = book.dataset.title;

            if (!isActive) {
                console.log('Story not yet available:', title);
                return;
            }

            console.log(`Opening story ${id}: ${title}`);
            
            // Get last viewed segment
            try {
                const lastSegment = await ipcRenderer.invoke('progress:getLastViewed', {
                    userId: currentUser.id,
                    storyId: id
                });
                
                // Navigate to story viewer with last segment
                if (lastSegment > 0) {
                    // Resume from last viewed segment
                    window.location.href = `story-viewer.html?id=${id}&segment=${lastSegment}`;
                } else {
                    // Start from beginning
                    window.location.href = `story-viewer.html?id=${id}`;
                }
            } catch (error) {
                console.error('Error getting last viewed segment:', error);
                // Fallback to beginning
                window.location.href = `story-viewer.html?id=${id}`;
            }
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

// ============================================
// SEARCH FUNCTIONALITY
// ============================================
const searchInput = document.getElementById('searchInput');
const clearSearch = document.getElementById('clearSearch');

if (searchInput && clearSearch) {
    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase();
        console.log('Search query:', query);
        
        // Show/hide clear button
        clearSearch.style.opacity = query ? '1' : '0.7';
        
        // TODO: Implement search filtering
    });

    clearSearch.addEventListener('click', function() {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        searchInput.focus();
    });
}

// ============================================
// VIEW ALL LINKS
// ============================================
setTimeout(() => {
    const viewAllLinks = document.querySelectorAll('.view-all-link');
    viewAllLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('View all clicked');
            
            // TODO: Show all books in category
            alert('View all books - Coming soon!');
        });
    });
}, 500); // Small delay to ensure elements are rendered