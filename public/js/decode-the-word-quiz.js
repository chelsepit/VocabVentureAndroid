// decode-the-word-quiz.js — Capacitor/Android version
// FIXED: finishQuiz() now awaits saveQuizResults() before redirecting.
//        Previously the DB write was abandoned mid-flight because
//        window.location.href fired before the async save completed,
//        leaving quiz-2 badge missing → progress bar never turned green.
import { enforceQuizOrientation } from './orientation.js';
import { db } from './db/db-interface.js';

let storyData = null;
let quizData = null;
let currentQuestionIndex = 0;
let score = 0;
let userAnswers = [];

function getStoryId() {
    const urlParams = new URLSearchParams(window.location.search);
    return parseInt(urlParams.get('story') || sessionStorage.getItem('quizStoryId')) || 1;
}

function getUserId() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    return currentUser?.id || parseInt(localStorage.getItem('lastUserId')) || 'guest';
}

async function loadQuizData() {
    const storyId = getStoryId();
    try {
        const response = await fetch(`../../data/stories/story-${storyId}.json`);
        if (!response.ok) throw new Error('Story not found');
        storyData = await response.json();
        quizData  = storyData.quiz2;
        document.getElementById('totalQuestions').textContent = quizData.questions.length;
    } catch (error) {
        console.error('Error loading quiz:', error);
        alert('Failed to load quiz. Redirecting to library...');
        window.location.href = 'library.html';
    }
}

window.startDecodeWord = function startDecodeWord() {
    document.getElementById('quizIntro').style.display    = 'none';
    document.getElementById('quizQuestion').style.display = 'block';
    loadQuestion(0);
}

function loadQuestion(index) {
    if (!quizData || index >= quizData.questions.length) return;
    currentQuestionIndex = index;
    const question = quizData.questions[index];

    document.getElementById('currentQuestion').textContent = index + 1;
    document.getElementById('sentenceText').innerHTML      = formatSentenceWithUnderline(question.question, question.underlinedWord);
    document.getElementById('questionPrompt').textContent  = question.questionPrompt;

    const buttonsContainer = document.getElementById('answerButtons');
    buttonsContainer.innerHTML = '';
    question.options.forEach((option, idx) => {
        const button = document.createElement('button');
        button.className   = 'answer-btn start-button';
        button.textContent = option;
        button.onclick     = () => checkAnswer(idx);
        buttonsContainer.appendChild(button);
    });

    document.getElementById('feedbackMessage').style.display = 'none';
}

function formatSentenceWithUnderline(sentence, wordToUnderline) {
    const regex = new RegExp(`\\b${wordToUnderline}\\b`, 'gi');
    return sentence.replace(regex, (match) =>
        `<span style="text-decoration:underline;text-decoration-thickness:2px;text-decoration-color:#000;font-weight:700;">${match}</span>`
    );
}

function checkAnswer(selectedIndex) {
    const question  = quizData.questions[currentQuestionIndex];
    const isCorrect = selectedIndex === question.correctAnswer;
    if (isCorrect) score++;

    userAnswers.push({ questionIndex: currentQuestionIndex, selectedIndex, correct: isCorrect });
    showFeedback(isCorrect, question.explanation);

    const buttons = document.querySelectorAll('#answerButtons .start-button');
    buttons.forEach((btn, idx) => {
        btn.disabled     = true;
        btn.style.cursor = 'not-allowed';
        if (idx === question.correctAnswer) {
            btn.style.background = '#4ade80';
            btn.style.border     = '3px solid #22c55e';
            btn.style.color      = 'white';
            btn.style.transform  = 'scale(1.05)';
        } else if (idx === selectedIndex && !isCorrect) {
            btn.style.background = '#ef4444';
            btn.style.border     = '3px solid #dc2626';
            btn.style.color      = 'white';
        } else {
            btn.style.opacity = '0.4';
        }
    });

    setTimeout(() => {
        if (currentQuestionIndex < quizData.questions.length - 1) loadQuestion(currentQuestionIndex + 1);
        else finishQuiz();
    }, 3000);
}

function showFeedback(isCorrect, explanation) {
    const el = document.getElementById('feedbackMessage');
    el.innerHTML = `
        <div style="color:#000;">
            <div style="font-size:2rem;margin-bottom:10px;">${isCorrect ? '✓' : '✗'}</div>
            <div style="font-size:2.3rem;">${isCorrect ? 'Correct!' : 'Not quite!'}</div>
            <div style="font-size:1.8rem;margin-top:10px;font-weight:normal;opacity:0.9;">${explanation}</div>
        </div>`;
    el.style.background = isCorrect ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)';
    el.style.border     = isCorrect ? '2px solid #4ade80'    : '2px solid #ef4444';
    el.style.display    = 'block';
}

function calculateBadgeType(score, total) {
    if (score === total)           return 'gold';
    if (score >= 3 && score <= 4) return 'silver';
    return 'bronze';
}

// ✅ FIX: was a plain function that called saveQuizResults() without await,
//         then immediately navigated — the SQLite write was abandoned mid-flight.
//         Now async, awaits the save before redirecting.
async function finishQuiz() {
    const badgeType = calculateBadgeType(score, quizData.questions.length);
    sessionStorage.setItem('quiz2Results', JSON.stringify({
        score,
        total: quizData.questions.length,
        percentage: Math.round((score / quizData.questions.length) * 100),
        badgeType,
        answers: userAnswers
    }));
    await saveQuizResults(badgeType);   // ✅ wait for DB write to complete
    window.location.href = `game-result.html?story=${getStoryId()}&quiz=2`;
}

async function saveQuizResults(badgeType) {
    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const storyId = getStoryId();
        if (currentUser) {
            await db.saveQuizResult(currentUser.id, storyId, 2, score, quizData.questions.length);
            await db.awardBadge(currentUser.id, storyId, badgeType, 'quiz-2');
            console.log(`Quiz 2 results saved — ${badgeType} badge awarded`);
        }
    } catch (error) {
        console.error('Error saving quiz results:', error);
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    await enforceQuizOrientation();  // 🔒 Lock portrait & block landscape
    await loadQuizData();            // Then load quiz normally
});