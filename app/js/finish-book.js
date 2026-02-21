// finish-book.js - Story Completion with BRONZE BADGE
// Uses bridge.js instead of ipcRenderer — works on Electron AND Android.

let completedStory = null;

async function initFinishPage() {
    const storedData = sessionStorage.getItem('completedStory');

    if (!storedData) {
        console.error('No completion data found');
        window.location.href = 'library.html';
        return;
    }

    completedStory = JSON.parse(storedData);
    displayBronzeBadge();
    await saveStoryCompletion();
}

function displayBronzeBadge() {
    const badgeImage = document.getElementById('badgeImage');
    const completionMessage = document.getElementById('completionMessage');

    badgeImage.src = '../../assets/images/badges/bronze-badge.png';
    badgeImage.alt = 'Bronze Badge - Story Completed';

    if (completedStory) {
        completionMessage.innerHTML = `
            <strong class="congrats">Congratulations!</strong><br>
            You've earned a <strong style="color:#CD7F32;">BRONZE BADGE</strong> for completing <strong>"${completedStory.title}"</strong>!<br><br>
        `;
    }
}

function continueToGames() {
    if (completedStory) {
        sessionStorage.setItem('quizStoryId', completedStory.id);
        window.location.href = `pick-a-word.html?story=${completedStory.id}`;
    }
}

async function saveStoryCompletion() {
    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));

        if (currentUser && completedStory) {
            for (let i = 1; i <= completedStory.totalSegments; i++) {
                await bridge.invoke('progress:save', {
                    userId: currentUser.id,
                    storyId: completedStory.id,
                    segmentId: i
                });
            }

            await bridge.invoke('badge:award', {
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

window.addEventListener('DOMContentLoaded', initFinishPage);
