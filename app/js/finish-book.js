// finish-book.js - Story Completion Page Logic with Dynamic Gold Badge

let completedStory = null;

// Initialize page
async function initFinishPage() {
    // Get completed story data from sessionStorage
    const storedData = sessionStorage.getItem('completedStory');
    
    if (!storedData) {
        console.error('No completion data found');
        // Redirect back to library
        window.location.href = 'library.html';
        return;
    }
    
    completedStory = JSON.parse(storedData);
    console.log('Story completed:', completedStory);
    
    // Display the gold badge
    displayGoldBadge();
    
    // Save to database and award badge
    await saveStoryCompletion();
}

// Display gold badge for completing the story
function displayGoldBadge() {
    const badgeImage = document.getElementById('badgeImage');
    const completionMessage = document.getElementById('completionMessage');
    
    // Set gold badge image
    badgeImage.src = '../../assets/images/badges/gold-badge.png';
    badgeImage.alt = 'Gold Badge - Story Completed';
    
    // Update completion message
    if (completedStory) {
        completionMessage.innerHTML = `
            <strong>Congratulations!</strong><br>
            You've earned a <strong style="color: #FFD700;">GOLD BADGE</strong> for completing <strong>"${completedStory.title}"</strong>!<br>
            Ready to test your vocabulary knowledge?
        `;
    }
}

// Continue to vocabulary games (Quiz 1)
function continueToGames() {
    if (completedStory) {
        // Store story ID for quiz pages
        sessionStorage.setItem('quizStoryId', completedStory.id);
        
        // Go directly to Quiz 1 (Pic-a-Word)
        window.location.href = `pick-a-word.html?story=${completedStory.id}`;
    }
}

// Save story completion to database
async function saveStoryCompletion() {
    try {
        const { ipcRenderer } = require('electron');
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        
        if (currentUser && completedStory) {
            // Mark all segments as completed
            for (let i = 1; i <= completedStory.totalSegments; i++) {
                await ipcRenderer.invoke('progress:save', {
                    userId: currentUser.id,
                    storyId: completedStory.id,
                    segmentId: i
                });
            }
            
            // Award GOLD badge for completing the story
            await ipcRenderer.invoke('badge:award', {
                userId: currentUser.id,
                storyId: completedStory.id,
                badgeType: 'gold',
                badgeCategory: 'story-completion'
            });
            
            console.log('Story completion saved - GOLD badge awarded');
        }
    } catch (error) {
        console.error('Error saving completion:', error);
    }
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', initFinishPage);