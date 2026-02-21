// decode-the-word-quiz.js - Decode the Word Quiz Logic (Quiz 2)
// Uses bridge.js instead of ipcRenderer — works on Electron AND Android.

let storyData = null;
let quizData  = null;
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

function getSavedQuizProgress() {
    const saved = localStorage.getItem(`quiz2_progress_${getUserId()}_${getStoryId()}`);
    try { return saved ? JSON.parse(saved) : null; }
    catch (_) { return null; }
}

function saveQuizProgress(questionIndex, score, answers) {
    localStorage.setItem(`quiz2_progress_${getUserId()}_${getStoryId()}`, JSON.stringify({
        questionIndex, score, answers, timestamp: Date.now()
    }));
}

function showQuizResumeModal() {
    const modal = document.getElementById('resumeModalOverlay');
    if (modal) modal.classList.remove('hidden');
}

function hideResumeModal() {
    const modal = document.getElementById('resumeModalOverlay');
    if (modal) modal.classList.add('hidden');
}

function continueGame() {
    hideResumeModal();
    const savedProgress = getSavedQuizProgress();
    if (savedProgress && quizData) {
        currentQuestionIndex = savedProgress.questionIndex;
        score       = savedProgress.score;
        userAnswers = savedProgress.answers;
        document.getElementById('quizIntro').style.display    = 'none';
        document.getElementById('quizQuestion').style.display = 'block';
        loadQuestion(currentQuestionIndex);
    }
}

function startAgain() {
    hideResumeModal();
    localStorage.removeItem(`quiz2_progress_${getUserId()}_${getStoryId()}`);
    currentQuestionIndex = 0; score = 0; userAnswers = [];
    document.getElementById('quizQuestion').style.display = 'none';
    document.getElementById('quizIntro').style.display    = 'block';
}

function startOver() { startAgain(); }

async function loadQuizData() {
    const storyId = getStoryId();
    try {
        const response = await fetch(`../../data/stories/story-${storyId}.json`);
        if (!response.ok) throw new Error('Story not found');
        storyData = await response.json();
        quizData  = storyData.quiz2;
        document.getElementById('totalQuestions').textContent = quizData.questions.length;

        const savedProgress = getSavedQuizProgress();
        if (savedProgress && savedProgress.questionIndex < quizData.questions.length) {
            showQuizResumeModal();
        }
    } catch (error) {
        console.error('Error loading quiz:', error);
        alert('Failed to load quiz. Redirecting to library...');
        window.location.href = 'library.html';
    }
}

function startDecodeWord() {
    document.getElementById('quizIntro').style.display    = 'none';
    document.getElementById('quizQuestion').style.display = 'block';
    loadQuestion(0);
}

function loadQuestion(index) {
    if (!quizData || index >= quizData.questions.length) return;

    currentQuestionIndex = index;
    const question = quizData.questions[index];
    document.getElementById('currentQuestion').textContent = index + 1;

    document.getElementById('sentenceText').innerHTML  = formatSentenceWithUnderline(question.question, question.underlinedWord);
    document.getElementById('questionPrompt').textContent = question.questionPrompt;

    const buttonsContainer = document.getElementById('answerButtons');
    buttonsContainer.innerHTML = '';

    question.options.forEach((option, idx) => {
        const button = document.createElement('button');
        button.className = 'answer-btn';
        button.textContent = option;
        button.onclick = () => checkAnswer(idx);
        buttonsContainer.appendChild(button);
    });

    document.getElementById('feedbackMessage').style.display = 'none';
}

function formatSentenceWithUnderline(sentence, wordToUnderline) {
    const regex = new RegExp(`\\b${wordToUnderline}\\b`, 'gi');
    return sentence.replace(regex, match =>
        `<span style="text-decoration:underline;text-decoration-thickness:2px;text-decoration-color:#ffffff;font-weight:700">${match}</span>`
    );
}

function checkAnswer(selectedIndex) {
    const question  = quizData.questions[currentQuestionIndex];
    const isCorrect = selectedIndex === question.correctAnswer;

    if (isCorrect) score++;
    userAnswers.push({ questionIndex: currentQuestionIndex, selectedIndex, correct: isCorrect });
    saveQuizProgress(currentQuestionIndex, score, userAnswers);
    showFeedback(isCorrect, question.explanation);

    const buttons = document.querySelectorAll('#answerButtons .answer-btn');
    buttons.forEach((btn, idx) => {
        btn.disabled = true;
        btn.style.cursor = 'not-allowed';
        if (idx === question.correctAnswer) {
            btn.style.background = '#4ade80'; btn.style.border = '3px solid #22c55e';
            btn.style.color = 'white'; btn.style.transform = 'scale(1.05)';
        } else if (idx === selectedIndex && !isCorrect) {
            btn.style.background = '#ef4444'; btn.style.border = '3px solid #dc2626'; btn.style.color = 'white';
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
    el.innerHTML = isCorrect
        ? `<div style="color:#fff"><div style="font-size:2rem;margin-bottom:10px">✓</div><div style="font-size:2.3rem">Correct!</div><div style="font-size:1.8rem;margin-top:10px;font-weight:normal;opacity:0.9">${explanation}</div></div>`
        : `<div style="color:#fff"><div style="font-size:2rem;margin-bottom:10px">✗</div><div style="font-size:2.3rem">Not quite!</div><div style="font-size:1.8rem;margin-top:10px;font-weight:normal;opacity:0.9">${explanation}</div></div>`;
    el.style.background = isCorrect ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)';
    el.style.border      = isCorrect ? '2px solid #4ade80'    : '2px solid #ef4444';
    el.style.display     = 'block';
}

function calculateBadgeType(score, total) {
    return score === total ? 'gold' : 'bronze';
}

async function finishQuiz() {
    const badgeType = calculateBadgeType(score, quizData.questions.length);
    const storyId   = getStoryId();

    localStorage.removeItem(`quiz2_progress_${getUserId()}_${storyId}`);

    sessionStorage.setItem('quiz2Results', JSON.stringify({
        score, total: quizData.questions.length,
        percentage: Math.round((score / quizData.questions.length) * 100),
        badgeType, answers: userAnswers
    }));

    await saveQuizResults(badgeType);
    window.location.href = `game-result.html?story=${storyId}&quiz=2`;
}

async function saveQuizResults(badgeType) {
    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (currentUser) {
            await bridge.invoke('quiz:save', {
                userId: currentUser.id,
                storyId: getStoryId(),
                quizNumber: 2,
                score,
                totalQuestions: quizData.questions.length,
                badgeType
            });
        }
    } catch (error) {
        console.error('Error saving quiz results:', error);
    }
}

window.addEventListener('DOMContentLoaded', loadQuizData);
