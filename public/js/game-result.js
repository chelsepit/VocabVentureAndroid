// game-result.js — Capacitor/Android version
// FIX 1: displayResults() now awaits upgradeBadge() — it was async but the
//         caller didn't await it, so the DB write raced against the page rendering.
// FIX 2: upgradeBadge() now defensively re-awards the quiz badge (quiz-1 or quiz-2)
//         in case the write in the quiz page was lost due to the fire-and-forget bug.

import { db } from './db/db-interface.js';

let quizResults = null;
let currentQuizNumber = 1;
let storyId = 1;

function getParams() {
    const urlParams = new URLSearchParams(window.location.search);
    storyId           = parseInt(urlParams.get('story')) || parseInt(sessionStorage.getItem('quizStoryId')) || 1;
    currentQuizNumber = parseInt(urlParams.get('quiz')) || 1;
}

function loadResults() {
    getParams();
    const storageKey    = `quiz${currentQuizNumber}Results`;
    const storedResults = sessionStorage.getItem(storageKey);

    if (!storedResults) {
        document.getElementById('resultMessage').textContent = 'No results found. Redirecting...';
        setTimeout(() => window.location.href = 'library.html', 2000);
        return;
    }
    quizResults = JSON.parse(storedResults);
    displayResults();
}

async function displayResults() {
    const quizScore = quizResults.score;   // renamed to avoid shadowing outer vars
    const total     = quizResults.total;
    const passedQuiz = quizScore === total;

    document.getElementById('scoreDisplay').textContent = `${quizScore}/${total}`;

    let resultTitle, resultMessage, badgeType;

    if (currentQuizNumber === 1) {
        if (passedQuiz) {
            resultTitle   = 'EXCELLENT!';
            resultMessage = '🥈 Badge upgraded to SILVER!';
            badgeType     = 'silver';
            await upgradeBadge('silver');   // ✅ FIX: was not awaited
            quizScore === 5 ? playAudioSequence(['hooray', 'continue']) : playAudio('nicejob');
        } else {
            resultTitle   = 'NOT QUITE!';
            resultMessage = `You need 4-5 correct to upgrade to Silver. You got ${quizScore}/5. Try again!`;
            badgeType     = 'bronze';
            playAudio('nicejob');
        }
    } else {
        if (passedQuiz) {
            resultTitle   = 'PERFECT!';
            resultMessage = '🥇 Badge upgraded to GOLD! You\'re a vocabulary master!';
            badgeType     = 'gold';
            await upgradeBadge('gold');     // ✅ FIX: was not awaited
            playAudio('excellent');
        } else {
            resultTitle   = 'ALMOST THERE!';
            resultMessage = `You need 4-5 correct to upgrade to Gold. You got ${quizScore}/5. Keep trying!`;
            badgeType     = 'silver';
            playAudio('nicejob2');
        }
    }

    document.getElementById('resultTitle').textContent   = resultTitle;
    document.getElementById('resultMessage').textContent = resultMessage;

    showBadge(badgeType);
    createButtons(passedQuiz);
}

function playAudio(audioType) {
    const selectedVoice = localStorage.getItem('selected_voice') || 'boy';
    const volume = parseInt(localStorage.getItem('volume') || '70') / 100;
    const audio = new Audio(`../../assets/audio/button-sounds/${audioType}_${selectedVoice}.mp3`);
    audio.volume = volume;
    audio.play().catch(() => {});
}

function playAudioSequence(audioTypes) {
    const selectedVoice = localStorage.getItem('selected_voice') || 'boy';
    const volume = parseInt(localStorage.getItem('volume') || '70') / 100;
    let i = 0;
    function playNext() {
        if (i >= audioTypes.length) return;
        const audio = new Audio(`../../assets/audio/button-sounds/${audioTypes[i]}_${selectedVoice}.mp3`);
        audio.volume = volume;
        audio.addEventListener('ended', () => { i++; playNext(); });
        audio.play().catch(() => { i++; playNext(); });
    }
    playNext();
}

// ✅ FIX: Also defensively re-awards the quiz badge for the current quiz number.
//    If the fire-and-forget in the quiz page dropped the write, this recovers it.
//    getStoryCompletionStatus() checks for 'quiz-1' and 'quiz-2' badge categories —
//    if either is missing the progress bar stays at 75% and never turns green.
async function upgradeBadge(newBadgeType) {
    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser) return;

        // Save quiz result record
        await db.saveQuizResult(currentUser.id, storyId, currentQuizNumber, quizResults.score, quizResults.total);

        // ✅ Defensively ensure the quiz badge category is written
        //    (may already exist from the quiz page, awardBadge handles duplicates)
        const quizCategory = `quiz-${currentQuizNumber}`;
        await db.awardBadge(currentUser.id, storyId, newBadgeType, quizCategory);

        // Upgrade the story-completion badge to reflect the new tier
        await db.upgradeBadge(currentUser.id, storyId, newBadgeType);

        console.log(`✅ Badge upgraded to ${newBadgeType.toUpperCase()} — quiz-${currentQuizNumber} badge ensured`);
    } catch (error) {
        console.error('Error upgrading badge:', error);
    }
}

function showBadge(badgeType) {
    let badgeContainer = document.getElementById('badgeContainer');
    if (!badgeContainer) {
        badgeContainer = document.createElement('div');
        badgeContainer.id = 'badgeContainer';
        badgeContainer.style.textAlign   = 'center';
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
             style="width:150px;height:150px;object-fit:contain;animation:bounceIn 0.6s;">
    `;
}

function createButtons(passed) {
    const buttonsContainer = document.querySelector('.finish-button');
    buttonsContainer.innerHTML = '';

    if (currentQuizNumber === 1) {
        if (passed) {
            buttonsContainer.innerHTML = `
                <button class="exit-button"    onclick="exitToLibrary()">EXIT</button>
                <button class="proceed-button" onclick="proceedToQuiz2()">PROCEED TO QUIZ 2</button>
            `;
        } else {
            buttonsContainer.innerHTML = `
                <button class="exit-button"   onclick="exitToLibrary()">EXIT</button>
                <button class="review-button" onclick="reviewVocabulary()">REVIEW VOCABULARY</button>
                <button class="retake-button" onclick="retakeQuiz()">RETAKE QUIZ</button>
            `;
        }
    } else {
        if (passed) {
            buttonsContainer.innerHTML = `<button class="exit-button" onclick="exitToLibrary()">EXIT TO LIBRARY</button>`;
        } else {
            buttonsContainer.innerHTML = `
                <button class="exit-button"   onclick="exitToLibrary()">EXIT</button>
                <button class="review-button" onclick="reviewVocabulary()">REVIEW VOCABULARY</button>
                <button class="retake-button" onclick="retakeQuiz()">RETAKE QUIZ</button>
            `;
        }
    }
}

window.exitToLibrary = function() {
    ['quiz1Results', 'quiz2Results', 'quizStoryId', 'completedStory'].forEach(k => sessionStorage.removeItem(k));
    window.location.href = 'library.html';
}

window.reviewVocabulary = function() { window.location.href = `lets-review.html?story=${storyId}`; }
window.proceedToQuiz2   = function() { window.location.href = `decode-the-word.html?story=${storyId}`; }

window.retakeQuiz = function() {
    sessionStorage.removeItem(`quiz${currentQuizNumber}Results`);
    window.location.href = currentQuizNumber === 1
        ? `pick-a-word.html?story=${storyId}`
        : `decode-the-word.html?story=${storyId}`;
}

window.addEventListener('DOMContentLoaded', loadResults);