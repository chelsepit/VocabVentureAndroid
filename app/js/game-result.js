// game-result.js - Quiz Results with BADGE UPGRADE SYSTEM

let quizResults = null;
let currentQuizNumber = 1;
let storyId = 1;

// Get parameters from URL
function getParams() {
    const urlParams = new URLSearchParams(window.location.search);
    storyId = parseInt(urlParams.get('story')) || parseInt(sessionStorage.getItem('quizStoryId')) || 1;
    currentQuizNumber = parseInt(urlParams.get('quiz')) || 1;
}

// Load quiz results
function loadResults() {
    getParams();
    
    const storageKey = `quiz${currentQuizNumber}Results`;
    const storedResults = sessionStorage.getItem(storageKey);
    
    if (!storedResults) {
        console.error('No quiz results found');
        document.getElementById('resultMessage').textContent = 'No results found. Redirecting...';
        setTimeout(() => window.location.href = 'library.html', 2000);
        return;
    }
    
    quizResults = JSON.parse(storedResults);
    console.log('Quiz results:', quizResults);
    
    displayResults();
}

// Display results with badge upgrade logic
async function displayResults() {
    const score = quizResults.score;
    const total = quizResults.total;
    const passedQuiz = score >= 4; // Need 4 or 5 out of 5 (80%+)
    
    // Update score display
    document.getElementById('scoreDisplay').textContent = `${score}/${total}`;
    
    let resultTitle, resultMessage, badgeType;
    
    if (currentQuizNumber === 1) {
        // QUIZ 1 RESULTS
        if (passedQuiz) {
            // Passed Quiz 1 → Upgrade to SILVER
            resultTitle = 'EXCELLENT!';
            resultMessage = '🥈 Badge upgraded to SILVER!';
            badgeType = 'silver';
            await upgradeBadge('silver');
        } else {
            // Failed Quiz 1 → Stay BRONZE
            resultTitle = 'NOT QUITE!';
            resultMessage = `You need 4-5 correct to upgrade to Silver. You got ${score}/5. Try again!`;
            badgeType = 'bronze';
        }
    } else {
        // QUIZ 2 RESULTS
        if (passedQuiz) {
            // Passed Quiz 2 → Upgrade to GOLD
            resultTitle = 'PERFECT!';
            resultMessage = '🥇 Badge upgraded to GOLD! You\'re a vocabulary master!';
            badgeType = 'gold';
            await upgradeBadge('gold');
        } else {
            // Failed Quiz 2 → Stay SILVER
            resultTitle = 'ALMOST THERE!';
            resultMessage = `You need 4-5 correct to upgrade to Gold. You got ${score}/5. Keep trying!`;
            badgeType = 'silver';
        }
    }
    
    // Update display
    document.getElementById('resultTitle').textContent = resultTitle;
    document.getElementById('resultMessage').textContent = resultMessage;
    
    // Show badge
    showBadge(badgeType);
    
    // Create buttons
    createButtons(passedQuiz);
}

// Upgrade badge in database
async function upgradeBadge(newBadgeType) {
    try {
        const { ipcRenderer } = require('electron');
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        
        if (currentUser) {
            // Save quiz result
            await ipcRenderer.invoke('quiz:save', {
                userId: currentUser.id,
                storyId: storyId,
                quizNumber: currentQuizNumber,
                score: quizResults.score,
                totalQuestions: quizResults.total,
                badgeType: newBadgeType
            });
            
            // Upgrade badge (this will update the existing badge)
            await ipcRenderer.invoke('badge:upgrade', {
                userId: currentUser.id,
                storyId: storyId,
                newBadgeType: newBadgeType
            });
            
            console.log(`✅ Badge upgraded to ${newBadgeType.toUpperCase()}`);
        }
    } catch (error) {
        console.error('Error upgrading badge:', error);
    }
}

// Show badge based on type
function showBadge(badgeType) {
    let badgeContainer = document.getElementById('badgeContainer');
    if (!badgeContainer) {
        badgeContainer = document.createElement('div');
        badgeContainer.id = 'badgeContainer';
        badgeContainer.style.textAlign = 'center';
        badgeContainer.style.marginBottom = '20px';
        
        const titleElement = document.getElementById('resultTitle');
        titleElement.parentNode.insertBefore(badgeContainer, titleElement);
    }
    
    const badgePaths = {
        'gold': '../../assets/images/badges/gold-badge.png',
        'silver': '../../assets/images/badges/silver-badge.png',
        'bronze': '../../assets/images/badges/bronze-badge.png'
    };
    
    const badgePath = badgePaths[badgeType] || badgePaths['bronze'];
    
    badgeContainer.innerHTML = `
        <img src="${badgePath}" alt="${badgeType} badge" style="width: 150px; height: 150px; object-fit: contain; animation: bounceIn 0.6s;">
    `;
}

// Create buttons based on pass/fail
function createButtons(passed) {
    const buttonsContainer = document.querySelector('.finish-button');
    buttonsContainer.innerHTML = '';
    
    if (currentQuizNumber === 1) {
        // QUIZ 1
        if (passed) {
            // Passed → Can proceed to Quiz 2
            buttonsContainer.innerHTML = `
                <button class="exit-button" onclick="exitToLibrary()">EXIT</button>
                <button class="proceed-button" onclick="proceedToQuiz2()">PROCEED TO QUIZ 2</button>
            `;
        } else {
            // Failed → Must retake or review
            buttonsContainer.innerHTML = `
                <button class="exit-button" onclick="exitToLibrary()">EXIT</button>
                <button class="review-button" onclick="reviewVocabulary()">REVIEW VOCABULARY</button>
                <button class="retake-button" onclick="retakeQuiz()">RETAKE QUIZ</button>
            `;
        }
    } else {
        // QUIZ 2
        if (passed) {
            // Passed → Gold achieved, just exit
            buttonsContainer.innerHTML = `
                <button class="exit-button" onclick="exitToLibrary()">EXIT TO LIBRARY</button>
            `;
        } else {
            // Failed → Must retake or review
            buttonsContainer.innerHTML = `
                <button class="exit-button" onclick="exitToLibrary()">EXIT</button>
                <button class="review-button" onclick="reviewVocabulary()">REVIEW VOCABULARY</button>
                <button class="retake-button" onclick="retakeQuiz()">RETAKE QUIZ</button>
            `;
        }
    }
}

// Exit to library
function exitToLibrary() {
    sessionStorage.removeItem('quiz1Results');
    sessionStorage.removeItem('quiz2Results');
    sessionStorage.removeItem('quizStoryId');
    sessionStorage.removeItem('completedStory');
    window.location.href = 'library.html';
}

// Review vocabulary
function reviewVocabulary() {
    window.location.href = `lets-review.html?story=${storyId}`;
}

// Retake quiz
function retakeQuiz() {
    sessionStorage.removeItem(`quiz${currentQuizNumber}Results`);
    
    if (currentQuizNumber === 1) {
        window.location.href = `pick-a-word.html?story=${storyId}`;
    } else {
        window.location.href = `decode-the-word.html?story=${storyId}`;
    }
}

// Proceed to Quiz 2 (only after passing Quiz 1)
function proceedToQuiz2() {
    window.location.href = `decode-the-word.html?story=${storyId}`;
}

// Initialize
window.addEventListener('DOMContentLoaded', loadResults);