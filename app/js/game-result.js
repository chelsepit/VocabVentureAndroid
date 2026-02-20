// game-result.js - Quiz Results with BADGE UPGRADE + AUDIO FEEDBACK

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

// Display results with badge upgrade logic and audio
async function displayResults() {
    const score = quizResults.score;
    const total = quizResults.total;
    const passedQuiz = score > 4; // Need 4 or 5 out of 5 (80%+)
    
    // Update score display
    document.getElementById('scoreDisplay').textContent = `${score}/${total}`;
    
    let resultTitle, resultMessage, badgeType;
    
    if (currentQuizNumber === 1) {
        // QUIZ 1 RESULTS
        if (passedQuiz) {
            // Perfect/Passed Quiz 1 → Upgrade to SILVER
            resultTitle = 'EXCELLENT!';
            resultMessage = '🥈 Badge upgraded to SILVER!';
            badgeType = 'silver';
            await upgradeBadge('silver');
            
            // ⭐ Play audio based on score
            if (score === 5) {
                // Perfect score - play hooray + continue
                playAudioSequence(['hooray', 'continue']);
            } else {
                // Good score (4/5) - play nicejob
                playAudio('nicejob');
            }
        } else {
            // Failed Quiz 1 → Stay BRONZE
            resultTitle = 'NOT QUITE!';
            resultMessage = `You need 5 correct to upgrade to Silver. You got ${score}/5. Try again!`;
            badgeType = 'bronze';
            
            // ⭐ Play nicejob audio for failed attempt
            playAudio('nicejob');
        }
    } else {
        // QUIZ 2 RESULTS
        if (passedQuiz) {
            // Perfect/Passed Quiz 2 → Upgrade to GOLD
            resultTitle = 'PERFECT!';
            resultMessage = '🥇 Badge upgraded to GOLD! You\'re a vocabulary master!';
            badgeType = 'gold';
            await upgradeBadge('gold');
            
            // ⭐ Play excellent audio
            playAudio('excellent');
        } else {
            // Failed Quiz 2 → Stay SILVER
            resultTitle = 'ALMOST THERE!';
            resultMessage = `You need 4-5 correct to upgrade to Gold. You got ${score}/5. Keep trying!`;
            badgeType = 'silver';
            
            // ⭐ Play nicejob2 audio
            playAudio('nicejob2');
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

// ⭐ NEW: Play audio based on selected voice
function playAudio(audioType) {
    const selectedVoice = localStorage.getItem('selected_voice') || 'boy';
    const volume = parseInt(localStorage.getItem('volume') || '70') / 100;
    
    const audioPath = `../../assets/audio/button-sounds/${audioType}_${selectedVoice}.mp3`;
    
    console.log(`🔊 Playing audio: ${audioPath}`);
    
    const audio = new Audio(audioPath);
    audio.volume = volume;
    
    audio.play().catch(error => {
        console.error('Audio play error:', error);
    });
}

// ⭐ NEW: Play audio sequence (hooray then continue)
function playAudioSequence(audioTypes) {
    const selectedVoice = localStorage.getItem('selected_voice') || 'boy';
    const volume = parseInt(localStorage.getItem('volume') || '70') / 100;
    
    let currentIndex = 0;
    
    function playNext() {
        if (currentIndex >= audioTypes.length) return;
        
        const audioType = audioTypes[currentIndex];
        const audioPath = `../../assets/audio/button-sounds/${audioType}_${selectedVoice}.mp3`;
        
        console.log(`🔊 Playing audio ${currentIndex + 1}/${audioTypes.length}: ${audioPath}`);
        
        const audio = new Audio(audioPath);
        audio.volume = volume;
        
        audio.addEventListener('ended', () => {
            currentIndex++;
            playNext();
        });
        
        audio.play().catch(error => {
            console.error('Audio play error:', error);
            // Try next audio even if current fails
            currentIndex++;
            playNext();
        });
    }
    
    playNext();
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
            
            // Upgrade badge
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
            buttonsContainer.innerHTML = `
                <button class="exit-button" onclick="exitToLibrary()">EXIT</button>
                <button class="proceed-button" onclick="proceedToQuiz2()">PROCEED TO QUIZ 2</button>
            `;
        } else {
            buttonsContainer.innerHTML = `
                <button class="exit-button" onclick="exitToLibrary()">EXIT</button>
                <button class="review-button" onclick="reviewVocabulary()">REVIEW VOCABULARY</button>
                <button class="retake-button" onclick="retakeQuiz()">RETAKE QUIZ</button>
            `;
        }
    } else {
        // QUIZ 2
        if (passed) {
            buttonsContainer.innerHTML = `
                <button class="exit-button" onclick="exitToLibrary()">EXIT TO LIBRARY</button>
            `;
        } else {
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

// Proceed to Quiz 2
function proceedToQuiz2() {
    window.location.href = `decode-the-word.html?story=${storyId}`;
}

// Initialize
window.addEventListener('DOMContentLoaded', loadResults);