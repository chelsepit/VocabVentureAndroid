// finish-book.js - Story Completion with BRONZE BADGE

let completedStory = null;

// Initialize page
async function initFinishPage() {
    // Get completed story data from sessionStorage
    const storedData = sessionStorage.getItem('completedStory');
    
    if (!storedData) {
        console.error('No completion data found');
        window.location.href = 'library.html';
        return;
    }
    
    completedStory = JSON.parse(storedData);
    console.log('Story completed:', completedStory);
    
    // Display the BRONZE badge
    displayBronzeBadge();
    
    // Save to database and award BRONZE badge
    await saveStoryCompletion();
}

// Display BRONZE badge for completing the story
function displayBronzeBadge() {
    const badgeImage = document.getElementById('badgeImage');
    const completionMessage = document.getElementById('completionMessage');
    
    // Set BRONZE badge image
    badgeImage.src = '../../assets/images/badges/bronze-badge.png';
    badgeImage.alt = 'Bronze Badge - Story Completed';
    
    // Update completion message
    if (completedStory) {
        completionMessage.innerHTML = `
            <strong class="congrats">Congratulations!</strong><br>
            
            You've earned a <strong style="color: #CD7F32;">BRONZE BADGE</strong> for completing <strong>"${completedStory.title}"</strong>!<br>
            <br>
        `;
    }
}

// Continue to vocabulary games (Quiz 1)
function continueToGames() {
    if (completedStory) {
        sessionStorage.setItem('quizStoryId', completedStory.id);
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
            
            // Award BRONZE badge for completing the story (1 badge per story, upgrades later)
            await ipcRenderer.invoke('badge:award', {
                userId: currentUser.id,
                storyId: completedStory.id,
                badgeType: 'bronze'
            });
            
            console.log('✅ Story completion saved - BRONZE badge awarded');
        }
    } catch (error) {
        console.error('Error saving completion:', error);
    }
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', initFinishPage);