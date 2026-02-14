// game-result.js - Quiz Results Page Logic with Dynamic Badge Display

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
    
    // Get results from sessionStorage
    const storageKey = `quiz${currentQuizNumber}Results`;
    const storedResults = sessionStorage.getItem(storageKey);
    
    if (!storedResults) {
        console.error('No quiz results found');
        document.getElementById('resultMessage').textContent = 'No results found. Redirecting...';
        setTimeout(() => {
            window.location.href = 'library.html';
        }, 2000);
        return;
    }
    
    quizResults = JSON.parse(storedResults);
    console.log('Quiz results:', quizResults);
    
    // Display results
    displayResults();
}

// Display results with dynamic badges
function displayResults() {
    const score = quizResults.score;
    const total = quizResults.total;
    const badgeType = quizResults.badgeType || calculateBadgeType(score, total);
    const isPerfectScore = score === total;
    
    // Update score display
    document.getElementById('scoreDisplay').textContent = `${score}/${total}`;
    
    // Determine result title and message
    let resultTitle, resultMessage;
    
    if (isPerfectScore) {
        // Perfect score = Gold badge
        resultTitle = 'PERFECT!';
        resultMessage = 'You\'re a vocabulary master! 🌟';
    } else {
        // Other scores
        if (score >= 3 && score <= 4) {
            resultTitle = 'GREAT JOB!';
            resultMessage = 'Almost perfect! Keep it up! 🏆';
        } else if (score >= 1 && score <= 2) {
            resultTitle = 'KEEP TRYING!';
            resultMessage = 'Practice makes perfect! 💪';
        } else {
            resultTitle = 'GOOD EFFORT!';
            resultMessage = 'You\'re learning! 👍';
        }
    }
    
    // Update display
    document.getElementById('resultTitle').textContent = resultTitle;
    document.getElementById('resultMessage').textContent = resultMessage;
    
    // Show appropriate badge dynamically
    showBadge(badgeType);
    
    // Create buttons based on score and quiz number
    createButtons(isPerfectScore);
}

// Calculate badge type based on score
function calculateBadgeType(score, total) {
    if (score === total) {
        return 'gold';
    } else if (score >= 3 && score <= 4) {
        return 'silver';
    } else {
        return 'bronze';
    }
}

// Show badge dynamically based on type
function showBadge(badgeType) {
    // Create badge display if not exists
    let badgeContainer = document.getElementById('badgeContainer');
    if (!badgeContainer) {
        badgeContainer = document.createElement('div');
        badgeContainer.id = 'badgeContainer';
        badgeContainer.style.textAlign = 'center';
        badgeContainer.style.marginBottom = '20px';
        
        // Insert before title
        const titleElement = document.getElementById('resultTitle');
        titleElement.parentNode.insertBefore(badgeContainer, titleElement);
    }
    
    // Badge image paths based on type
    let badgePath;
    switch(badgeType) {
        case 'gold':
            badgePath = '../../assets/images/badges/gold-badge.png';
            break;
        case 'silver':
            badgePath = '../../assets/images/badges/silver-badge.png';
            break;
        case 'bronze':
            badgePath = '../../assets/images/badges/bronze-badge.png';
            break;
        default:
            badgePath = '../../assets/images/badges/bronze-badge.png';
    }
    
    badgeContainer.innerHTML = `
        <img src="${badgePath}" alt="${badgeType} badge" style="width: 150px; height: 150px; object-fit: contain;">
    `;
}

// Create buttons based on score and quiz number
function createButtons(isPerfectScore) {
    const buttonsContainer = document.querySelector('.finish-button');
    buttonsContainer.innerHTML = ''; // Clear existing buttons
    
    if (currentQuizNumber === 1) {
        // Quiz 1 Results
        if (isPerfectScore) {
            // Perfect Score: EXIT + PROCEED TO DECODE
            buttonsContainer.innerHTML = `
                <button class="exit-button" onclick="exitToLibrary()">EXIT</button>
                <button class="proceed-button" onclick="proceedToQuiz2()">PROCEED TO DECODE-A-WORD</button>
            `;
        } else {
            // Not Perfect: EXIT + REVIEW + RETAKE
            buttonsContainer.innerHTML = `
                <button class="exit-button" onclick="exitToLibrary()">EXIT</button>
                <button class="review-button" onclick="reviewVocabulary()">REVIEW</button>
                <button class="retake-button" onclick="retakeQuiz()">RETAKE</button>
            `;
        }
    } else {
        // Quiz 2 Results
        if (isPerfectScore) {
            // Perfect Score: EXIT only
            buttonsContainer.innerHTML = `
                <button class="exit-button" onclick="exitToLibrary()">EXIT</button>
            `;
        } else {
            // Not Perfect: EXIT + REVIEW + RETAKE
            buttonsContainer.innerHTML = `
                <button class="exit-button" onclick="exitToLibrary()">EXIT</button>
                <button class="review-button" onclick="reviewVocabulary()">REVIEW</button>
                <button class="retake-button" onclick="retakeQuiz()">RETAKE</button>
            `;
        }
    }
}

// Exit to library
function exitToLibrary() {
    // Clear quiz data
    sessionStorage.removeItem('quiz1Results');
    sessionStorage.removeItem('quiz2Results');
    sessionStorage.removeItem('quizStoryId');
    sessionStorage.removeItem('completedStory');
    
    // Go to library
    window.location.href = 'library.html';
}

// Review vocabulary
function reviewVocabulary() {
    // Go to vocabulary review page
    window.location.href = `lets-review.html?story=${storyId}`;
}

// Retake quiz
function retakeQuiz() {
    // Clear current quiz results
    sessionStorage.removeItem(`quiz${currentQuizNumber}Results`);
    
    // Reload the quiz
    if (currentQuizNumber === 1) {
        window.location.href = `pick-a-word.html?story=${storyId}`;
    } else {
        window.location.href = `decode-the-word.html?story=${storyId}`;
    }
}

// Proceed to Quiz 2 (only from Quiz 1 with perfect score)
function proceedToQuiz2() {
    window.location.href = `decode-the-word.html?story=${storyId}`;
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', loadResults);