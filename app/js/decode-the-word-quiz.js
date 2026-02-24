// decode-the-word-quiz.js - Decode the Word Quiz Logic (Quiz 2) with Badge System

let storyData = null;
let quizData = null;
let currentQuestionIndex = 0;
let score = 0;
let userAnswers = [];

function getStoryId() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlStoryId = urlParams.get('story');
  const sessionStoryId = sessionStorage.getItem('quizStoryId');
  return parseInt(urlStoryId || sessionStoryId) || 1;
}

function getUserId() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  return currentUser?.id || parseInt(localStorage.getItem('lastUserId')) || 'guest';
}

// Check for saved quiz progress (localStorage only — never touches DB)
function getSavedQuizProgress() {
  const storyId = getStoryId();
  const savedProgress = localStorage.getItem(`quiz2_progress_${getUserId()}_${storyId}`);
  if (savedProgress) {
    try { return JSON.parse(savedProgress); } catch (e) { return null; }
  }
  return null;
}

// Save partial progress to localStorage only (never touches DB score columns)
function saveQuizProgress(nextQuestionIndex, currentScore) {
  const storyId = getStoryId();
  localStorage.setItem(`quiz2_progress_${getUserId()}_${storyId}`, JSON.stringify({
    partialQuestionIndex: nextQuestionIndex,
    partialScore: currentScore,
    timestamp: Date.now()
  }));
  console.log(`📊 Quiz 2 partial progress saved - Next question: ${nextQuestionIndex + 1}, Score: ${currentScore}`);
}

function showQuizResumeModal(savedProgress) {
  const modal = document.getElementById('resumeModalOverlay');
  if (modal) {
    modal.classList.remove('hidden');
    console.log('📻 Quiz resume modal shown - saved at question:', savedProgress.partialQuestionIndex + 1);
  }
}

function hideResumeModal() {
  const modal = document.getElementById('resumeModalOverlay');
  if (modal) modal.classList.add('hidden');
}

function continueGame() {
  console.log('▶️ Resuming quiz from saved progress');
  hideResumeModal();
  const savedProgress = getSavedQuizProgress();
  if (savedProgress && quizData) {
    currentQuestionIndex = savedProgress.partialQuestionIndex;
    score = savedProgress.partialScore;
    userAnswers = [];
    document.getElementById('quizIntro').style.display = 'none';
    document.getElementById('quizQuestion').style.display = 'block';
    loadQuestion(currentQuestionIndex);
    console.log(`📍 Resumed at question ${currentQuestionIndex + 1}, score: ${score}`);
  }
}

function startAgain() {
  console.log('🔄 Starting quiz over');
  hideResumeModal();
  localStorage.removeItem(`quiz2_progress_${getUserId()}_${getStoryId()}`);
  currentQuestionIndex = 0;
  score = 0;
  userAnswers = [];
  document.getElementById('quizQuestion').style.display = 'none';
  document.getElementById('quizIntro').style.display = 'block';
}

function startOver() { startAgain(); }

async function loadQuizData() {
  const storyId = getStoryId();
  try {
    const response = await fetch(`../../data/stories/story-${storyId}.json`);
    if (!response.ok) throw new Error('Story not found');
    storyData = await response.json();
    quizData = storyData.quiz2;
    console.log('Quiz loaded:', quizData.title);
    console.log('Questions:', quizData.questions.length);
    document.getElementById('totalQuestions').textContent = quizData.questions.length;
    const savedProgress = getSavedQuizProgress();
    if (savedProgress && savedProgress.partialQuestionIndex < quizData.questions.length) {
      console.log('🔄 Found saved quiz progress - showing resume modal');
      showQuizResumeModal(savedProgress);
    }
  } catch (error) {
    console.error('Error loading quiz:', error);
    alert('Failed to load quiz. Redirecting to library...');
    window.location.href = 'library.html';
  }
}

function startDecodeWord() {
  document.getElementById('quizIntro').style.display = 'none';
  document.getElementById('quizQuestion').style.display = 'block';
  loadQuestion(0);
}

function loadQuestion(index) {
  if (!quizData || index >= quizData.questions.length) return;
  currentQuestionIndex = index;
  const question = quizData.questions[index];
  document.getElementById('currentQuestion').textContent = index + 1;
  const sentenceWithUnderline = formatSentenceWithUnderline(question.question, question.underlinedWord);
  document.getElementById('sentenceText').innerHTML = sentenceWithUnderline;
  document.getElementById('questionPrompt').textContent = question.questionPrompt;
  const buttonsContainer = document.getElementById('answerButtons');
  buttonsContainer.innerHTML = '';
  question.options.forEach((option, idx) => {
    const button = document.createElement('button');
    button.className = 'answer-btn';
    button.textContent = String(option).toLowerCase();
    button.onclick = () => checkAnswer(idx);
    buttonsContainer.appendChild(button);
  });
  document.getElementById('feedbackMessage').style.display = 'none';
}

function formatSentenceWithUnderline(sentence, wordToUnderline) {
  const regex = new RegExp(`\\b${wordToUnderline}\\b`, 'gi');
  return sentence.replace(regex, (match) =>
    `<span style="text-decoration:underline;text-decoration-thickness:2px;text-decoration-color:#ffffff;font-weight:700;">${match}</span>`
  );
}

function checkAnswer(selectedIndex) {
  const question = quizData.questions[currentQuestionIndex];
  const isCorrect = selectedIndex === question.correctAnswer;
  if (isCorrect) score++;
  userAnswers.push({ questionIndex: currentQuestionIndex, selectedIndex, correct: isCorrect });

  // Save NEXT question index so resume lands on the correct unanswered question
  saveQuizProgress(currentQuestionIndex + 1, score);

  console.log('Stored answer:', { questionIndex: currentQuestionIndex, selectedIndex, correct: isCorrect, correctAnswer: question.correctAnswer });
  showFeedback(isCorrect, question.explanation);

  const buttons = document.querySelectorAll('#answerButtons .answer-btn');
  buttons.forEach((btn, idx) => {
    btn.disabled = true;
    btn.style.cursor = 'not-allowed';
    if (idx === question.correctAnswer) {
      btn.style.background = '#4ade80';
      btn.style.border = '3px solid #22c55e';
      btn.style.color = 'white';
      btn.style.transform = 'scale(1.05)';
    } else if (idx === selectedIndex && !isCorrect) {
      btn.style.background = '#ef4444';
      btn.style.border = '3px solid #dc2626';
      btn.style.color = 'white';
    } else {
      btn.style.opacity = '0.4';
    }
  });

  setTimeout(() => {
    if (currentQuestionIndex < quizData.questions.length - 1) {
      loadQuestion(currentQuestionIndex + 1);
    } else {
      finishQuiz();
    }
  }, 3000);
}

function showFeedback(isCorrect, explanation) {
    const feedbackElement = document.getElementById('feedbackMessage');
    
    if (isCorrect) {
        feedbackElement.innerHTML = `
            <div style="color: #ffffff;">
                <div style="font-size: clamp(1.8rem, 3.5vh, 1.8rem); margin-bottom: 10px;">✓</div>
                <div style="font-size: clamp(1.6rem, 3.5vh, 1.8rem);">Correct!</div>
                <div style="font-size: clamp(1.3rem, 3.5vh, 1.8rem); margin-top: 10px; font-weight: normal; opacity: 0.9;">
                    ${explanation}
                </div>
            </div>
        `;
        feedbackElement.style.background = 'rgba(74, 222, 128, 0.2)';
        feedbackElement.style.border = '2px solid #4ade80';
    } else {
        feedbackElement.innerHTML = `
            <div style="color: #ffffff;">
                <div style="font-size: clamp(1.8rem, 3.5vh, 1.8rem); margin-bottom: 10px;">✗</div>
                <div style="font-size: clamp(1.6rem, 3.5vh, 1.8rem);">Not quite!</div>
                <div style="font-size: clamp(1.3rem, 3.5vh, 1.8rem); margin-top: 10px; font-weight: normal; opacity: 0.9;">
                    ${explanation}
                </div>
            </div>
        `;
        feedbackElement.style.background = 'rgba(239, 68, 68, 0.2)';
        feedbackElement.style.border = '2px solid #ef4444';
    }
    
    feedbackElement.style.display = 'block';
}

function calculateBadgeType(score, total) {
  return score === total ? 'gold' : 'bronze';
}

async function finishQuiz() {
  const badgeType = calculateBadgeType(score, quizData.questions.length);
  const storyId = getStoryId();

  // Clear partial progress from localStorage
  localStorage.removeItem(`quiz2_progress_${getUserId()}_${storyId}`);

  sessionStorage.setItem('quiz2Results', JSON.stringify({
    score,
    total: quizData.questions.length,
    percentage: Math.round((score / quizData.questions.length) * 100),
    badgeType,
    answers: userAnswers
  }));

  // Await DB save before navigating so the score is committed
  await saveQuizResults(badgeType);
  window.location.href = `game-result.html?story=${storyId}&quiz=2`;
}

async function saveQuizResults(badgeType) {
  try {
    const { ipcRenderer } = require('electron');
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const storyId = getStoryId();
    if (currentUser) {
      await ipcRenderer.invoke('quiz:save', {
        userId: currentUser.id,
        storyId,
        quizNumber: 2,
        score,
        totalQuestions: quizData.questions.length,
        badgeType
      });
      console.log(`Quiz 2 results saved (${badgeType})`);
    }
  } catch (error) {
    console.error('Error saving quiz results:', error);
  }
}

window.addEventListener('DOMContentLoaded', loadQuizData);