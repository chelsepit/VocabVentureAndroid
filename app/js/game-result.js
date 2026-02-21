// game-result.js - Quiz Results with BADGE UPGRADE + AUDIO FEEDBACK
// Uses bridge.js instead of ipcRenderer — works on Electron AND Android.

let quizResults = null;
let currentQuizNumber = 1;
let storyId = 1;

function getParams() {
    const urlParams = new URLSearchParams(window.location.search);
    storyId = parseInt(urlParams.get('story')) || parseInt(sessionStorage.getItem('quizStoryId')) || 1;
    currentQuizNumber = parseInt(urlParams.get('quiz')) || 1;
}

function loadResults() {
    getParams();

    const storedResults = sessionStorage.getItem(`quiz${currentQuizNumber}Results`);
    if (!storedResults) {
        document.getElementById('resultMessage').textContent = 'No results found. Redirecting...';
        setTimeout(() => window.location.href = 'library.html', 2000);
        return;
    }

    quizResults = JSON.parse(storedResults);
    displayResults();
}

async function displayResults() {
    const score    = quizResults.score;
    const total    = quizResults.total;
    const passed   = score > 4;

    document.getElementById('scoreDisplay').textContent = `${score}/${total}`;

    let resultTitle, resultMessage, badgeType;

    if (currentQuizNumber === 1) {
        if (passed) {
            resultTitle   = 'EXCELLENT!';
            resultMessage = '🥈 Badge upgraded to SILVER!';
            badgeType     = 'silver';
            await upgradeBadge('silver');
            score === 5 ? playAudioSequence(['hooray', 'continue']) : playAudio('nicejob');
        } else {
            resultTitle   = 'NOT QUITE!';
            resultMessage = `You need 5 correct to upgrade to Silver. You got ${score}/5. Try again!`;
            badgeType     = 'bronze';
            playAudio('nicejob');
        }
    } else {
        if (passed) {
            resultTitle   = 'PERFECT!';
            resultMessage = '🥇 Badge upgraded to GOLD! You\'re a vocabulary master!';
            badgeType     = 'gold';
            await upgradeBadge('gold');
            playAudio('excellent');
        } else {
            resultTitle   = 'ALMOST THERE!';
            resultMessage = `You need 5 correct to upgrade to Gold. You got ${score}/5. Keep trying!`;
            badgeType     = 'silver';
            playAudio('nicejob2');
        }
    }

    document.getElementById('resultTitle').textContent   = resultTitle;
    document.getElementById('resultMessage').textContent = resultMessage;

    showBadge(badgeType);
    createButtons(passed);
}

function playAudio(audioType) {
    const selectedVoice = localStorage.getItem('selected_voice') || 'boy';
    const volume = parseInt(localStorage.getItem('volume') || '70') / 100;
    const audio  = new Audio(`../../assets/audio/button-sounds/${audioType}_${selectedVoice}.mp3`);
    audio.volume = volume;
    audio.play().catch(err => console.error('Audio play error:', err));
}

function playAudioSequence(audioTypes) {
    const selectedVoice = localStorage.getItem('selected_voice') || 'boy';
    const volume = parseInt(localStorage.getItem('volume') || '70') / 100;
    let index = 0;

    function playNext() {
        if (index >= audioTypes.length) return;
        const audio = new Audio(`../../assets/audio/button-sounds/${audioTypes[index]}_${selectedVoice}.mp3`);
        audio.volume = volume;
        audio.addEventListener('ended', () => { index++; playNext(); });
        audio.play().catch(() => { index++; playNext(); });
    }

    playNext();
}

async function upgradeBadge(newBadgeType) {
    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (currentUser) {
            await bridge.invoke('badge:award', {
                userId: currentUser.id,
                storyId,
                badgeType: newBadgeType
            });
            console.log(`✅ Badge upgraded to ${newBadgeType.toUpperCase()}`);
        }
    } catch (error) {
        console.error('Error upgrading badge:', error);
    }
}

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

    const paths = {
        gold:   '../../assets/images/badges/gold-badge.png',
        silver: '../../assets/images/badges/silver-badge.png',
        bronze: '../../assets/images/badges/bronze-badge.png'
    };

    badgeContainer.innerHTML = `
        <img src="${paths[badgeType] || paths.bronze}" alt="${badgeType} badge"
             style="width:150px;height:150px;object-fit:contain;animation:bounceIn 0.6s">
    `;
}

function createButtons(passed) {
    const container = document.querySelector('.finish-button');
    container.innerHTML = '';

    if (currentQuizNumber === 1) {
        container.innerHTML = passed
            ? `<button class="exit-button" onclick="exitToLibrary()">EXIT</button>
               <button class="proceed-button" onclick="proceedToQuiz2()">PROCEED TO QUIZ 2</button>`
            : `<button class="exit-button" onclick="exitToLibrary()">EXIT</button>
               <button class="review-button" onclick="reviewVocabulary()">REVIEW VOCABULARY</button>
               <button class="retake-button" onclick="retakeQuiz()">RETAKE QUIZ</button>`;
    } else {
        container.innerHTML = passed
            ? `<button class="exit-button" onclick="exitToLibrary()">EXIT TO LIBRARY</button>`
            : `<button class="exit-button" onclick="exitToLibrary()">EXIT</button>
               <button class="review-button" onclick="reviewVocabulary()">REVIEW VOCABULARY</button>
               <button class="retake-button" onclick="retakeQuiz()">RETAKE QUIZ</button>`;
    }
}

function exitToLibrary() {
    sessionStorage.removeItem('quiz1Results');
    sessionStorage.removeItem('quiz2Results');
    sessionStorage.removeItem('quizStoryId');
    sessionStorage.removeItem('completedStory');
    window.location.href = 'library.html';
}

function reviewVocabulary() {
    window.location.href = `lets-review.html?story=${storyId}`;
}

function retakeQuiz() {
    sessionStorage.removeItem(`quiz${currentQuizNumber}Results`);
    window.location.href = currentQuizNumber === 1
        ? `pick-a-word.html?story=${storyId}`
        : `decode-the-word.html?story=${storyId}`;
}

function proceedToQuiz2() {
    window.location.href = `decode-the-word.html?story=${storyId}`;
}

window.addEventListener('DOMContentLoaded', loadResults);
