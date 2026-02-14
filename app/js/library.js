// library.js - Library Page Functionality

const { ipcRenderer } = require('electron');

// Check authentication
const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser) {
    window.location.href = '../auth/login.html';
}

// ============================================
// LOAD USER PROGRESS
// ============================================
async function loadProgress() {
    try {
        // Get progress for each story
        for (let storyId = 1; storyId <= 30; storyId++) {
            try {
                const storyProgress = await ipcRenderer.invoke('progress:get', {
                    userId: currentUser.id,
                    storyId: storyId
                });
                
                // Calculate story progress (varies by story)
                const totalSegments = getTotalSegments(storyId);
                const completedSegments = storyProgress.filter(p => p.completed).length;
                const percentage = Math.round((completedSegments / totalSegments) * 100);
                
                // Update progress bars - only if they exist
                const progressBars = document.querySelectorAll(`[data-progress="${storyId}"]`);
                if (progressBars.length > 0) {
                    progressBars.forEach(bar => {
                        bar.style.width = percentage + '%';
                    });
                }
            } catch (err) {
                // Skip this story if progress load fails, keep default width
                console.log(`Could not load progress for story ${storyId}:`, err);
            }
        }
    } catch (error) {
        console.error('Error loading progress:', error);
        // Don't completely fail if progress database is unavailable
    }
}

// Get total segments for each story
function getTotalSegments(storyId) {
    const segments = {
        1: 13,  // How the Tinguian Learned to Plant
        7: 14,  // The Origin of the Rainbow
        13: 10  // The Butterfly & The Caterpillar
    };
    return segments[storyId] || 14; // Default to 14 segments
}

// Load progress after a short delay to ensure books are rendered
setTimeout(() => {
    loadProgress();
}, 500);

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
    }

    // 3. Render single book
    function renderBook(story) {
        const locked = !story.isActive;
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
                    <div class="progress-fill" style="width: 35%;" data-progress="${story.id}"></div>
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
            renderLibrary(filtered);
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
        book.addEventListener("click", () => {
            const isActive = book.dataset.active === "true";
            const id = book.dataset.id;
            const title = book.dataset.title;

            if (!isActive) {
                console.log('Story not yet available:', title);
                return;
            }

            console.log(`Opening story ${id}: ${title}`);
            
            // Navigate to story viewer
            // story-viewer.html should be in the same folder as library.html
            // Both should be in /app/pages/dashboard/
            window.location.href = `story-viewer.html?id=${id}`;
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