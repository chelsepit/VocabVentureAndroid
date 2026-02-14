// Personal Library JavaScript

document.addEventListener('DOMContentLoaded', function() {
    console.log('Personal Library loaded');

    // Get all book items
    const bookItems = document.querySelectorAll('.book-item');

    // Add click handlers to books
    bookItems.forEach(book => {
        book.addEventListener('click', function() {
            const storyId = this.getAttribute('data-story-id');
            console.log('Book clicked, story ID:', storyId);
            
            // Navigate to story page (adjust path as needed)
            // window.location.href = `story.html?id=${storyId}`;
        });

        // Add hover effect
        book.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
        });

        book.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });

    // Load progress from localStorage (if you want to persist progress)
    loadProgress();

    // View all links
    const viewAllLinks = document.querySelectorAll('.view-all-link');
    viewAllLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.closest('.bookshelf-section');
            const sectionTitle = section.querySelector('.section-title').textContent;
            console.log('View all clicked for:', sectionTitle);
            
            // You can implement view all functionality here
            // For example, navigate to a full list page or expand the section
        });
    });
});

// Function to load progress from localStorage
function loadProgress() {
    const progressBars = document.querySelectorAll('.progress-fill');
    
    progressBars.forEach(bar => {
        const progressId = bar.getAttribute('data-progress');
        if (progressId) {
            const savedProgress = localStorage.getItem(`progress-${progressId}`);
            if (savedProgress) {
                bar.style.width = savedProgress + '%';
            }
        }
    });
}

// Function to save progress (call this when user makes progress in a story)
function saveProgress(storyId, percentage) {
    localStorage.setItem(`progress-${storyId}`, percentage);
    
    // Update the progress bar if it exists on the page
    const progressBar = document.querySelector(`[data-progress="${storyId}"]`);
    if (progressBar) {
        progressBar.style.width = percentage + '%';
    }
}

// Function to mark book as completed
function markAsCompleted(storyId) {
    saveProgress(storyId, 100);
    
    // You might want to move the book from Recent Reads to Completed Books
    // This would require more complex logic to reorganize the DOM
}

// Export functions if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        saveProgress,
        markAsCompleted,
        loadProgress
    };
}