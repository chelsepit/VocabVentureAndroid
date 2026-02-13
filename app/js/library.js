// library.js - Library Page Functionality

const { ipcRenderer } = require('electron');

// Check authentication
const currentUser = JSON.parse(localStorage.getItem('currentUser'));
if (!currentUser) {
    window.location.href = 'pages/auth/login.html';
}

// ============================================
// LOAD USER PROGRESS
// ============================================
async function loadProgress() {
    try {
        // Get progress for each story
        for (let storyId = 1; storyId <= 3; storyId++) {
            const storyProgress = await ipcRenderer.invoke('progress:get', {
                userId: currentUser.id,
                storyId: storyId
            });
            
            // Calculate story progress (varies by story)
            const totalSegments = getTotalSegments(storyId);
            const completedSegments = storyProgress.filter(p => p.completed).length;
            const percentage = Math.round((completedSegments / totalSegments) * 100);
            
            // Update progress bars
            const progressBars = document.querySelectorAll(`[data-progress="${storyId}"]`);
            progressBars.forEach(bar => {
                bar.style.width = percentage + '%';
            });
        }
    } catch (error) {
        console.error('Error loading progress:', error);
    }
}

// Get total segments for each story
function getTotalSegments(storyId) {
    const segments = {
        1: 13, // Tinguian story
        2: 14, // Bighari story
        3: 10  // Butterfly story
    };
    return segments[storyId] || 14;
}

// Load progress on page load
loadProgress();

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
        .then(res => res.json())
        .then(data => {
            allStories = data.stories;
            renderLibrary(allStories);
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
    }

    // 3. Render single book
    function renderBook(story) {
        const lockedStyle = story.isActive ? "" : "style='opacity:0.5; cursor:not-allowed'";
        const lockOverlay = story.isActive ? "" : `<div class="coming-soon">Coming Soon</div>`;

        return `
            <div class="book-item"
                 data-id="${story.id}"
                 ${lockedStyle}>
                <div class="book-cover-wrapper">
                    <img src="../../${story.coverImage}" alt="${story.title}">
                    ${lockOverlay}
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
            genreTags.forEach(t => t.classList.remove("active"));
            tag.classList.add("active");

            const genre = tag.dataset.genre;
            const filtered = allStories.filter(s => s.genre === genre);
            renderLibrary(filtered);
        });
    });

    // 6. Helpers
    function formatGenre(genre) {
        return genre
            .replace("-", " ")
            .replace(/\b\w/g, l => l.toUpperCase());
    }
})();


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
// BOOK ITEM CLICK HANDLERS - UPDATED!
// ============================================
const bookItems = document.querySelectorAll('.book-item');
bookItems.forEach(item => {
    item.addEventListener('click', function() {
        const storyId = this.dataset.storyId;
        
        if (storyId) {
            console.log('Opening story:', storyId);
            
            // Navigate to story viewer with story ID
            window.location.href = `../stories/story-viewer.html?id=${storyId}`;
        }
    });
    
    // Add hover effect
    item.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-5px)';
        this.style.transition = 'transform 0.3s ease';
    });
    
    item.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
    });
});

// ============================================
// VIEW ALL LINKS
// ============================================
const viewAllLinks = document.querySelectorAll('.view-all-link');
viewAllLinks.forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('View all clicked');
        
        // TODO: Show all books in category
        alert('View all books - Coming soon!');
    });
});