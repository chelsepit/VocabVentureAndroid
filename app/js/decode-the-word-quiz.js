// decode-the-word-quiz.js - Decode the Word Quiz Logic (Quiz 2) with Badge System

let storyData = null;
let quizData = null;
let currentQuestionIndex = 0;
let score = 0;
let userAnswers = [];

// Get story ID
function getStoryId() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlStoryId = urlParams.get('story');
    const sessionStoryId = sessionStorage.getItem('quizStoryId');
    
    return parseInt(urlStoryId || sessionStoryId) || 1;
}

// Get current user ID (falls back to lastUserId)
function getUserId() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  return currentUser?.id || parseInt(localStorage.getItem('lastUserId')) || 'guest';
}

// Check for saved quiz progress (from DB)
async function getSavedQuizProgress() {
  const storyId = getStoryId();
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  if (!currentUser) return null;
  try {
    const { ipcRenderer } = require('electron');
    const partial = await ipcRenderer.invoke('quiz:getPartial', {
      userId: currentUser.id,
      storyId: storyId,
      quizNumber: 2
    });
    return partial; // { partialScore, partialQuestionIndex } or null
  } catch (e) {
    console.error('Error getting partial quiz progress:', e);
    return null;
  }
}

// Save quiz progress to DB (partial only — does NOT affect score/completion status)
async function saveQuizProgress(questionIndex, score, answers) {
  const storyId = getStoryId();
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  if (!currentUser) return;
  try {
    const { ipcRenderer } = require('electron');
    await ipcRenderer.invoke('quiz:savePartial', {
      userId: currentUser.id,
      storyId: storyId,
      quizNumber: 2,
      partialScore: score,
      partialQuestionIndex: questionIndex
    });
    console.log(`📊 Quiz 2 partial progress saved to DB - Question ${questionIndex + 1}, Score: ${score}`);
  } catch (e) {
    console.error('Error saving partial quiz progress:', e);
  }
}

// Show resume modal for quiz
function showQuizResumeModal(savedProgress) {
  const modal = document.getElementById('resumeModalOverlay');
  if (modal) {
    modal.classList.remove('hidden');
    console.log('📻 Quiz resume modal shown - saved at question:', savedProgress.questionIndex + 1);
  }
}

// Hide resume modal
function hideResumeModal() {
  const modal = document.getElementById('resumeModalOverlay');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Resume quiz from saved progress
async function continueGame() {
  console.log('▶️ Resuming quiz from saved progress');
  hideResumeModal();
  
  const savedProgress = await getSavedQuizProgress();
  if (savedProgress && quizData) {
    currentQuestionIndex = savedProgress.partialQuestionIndex;
    score = savedProgress.partialScore;
    userAnswers = [];
    
    // Show quiz screen
    document.getElementById('quizIntro').style.display = 'none';
    document.getElementById('quizQuestion').style.display = 'block';
    
    // Load the next unanswered question
    loadQuestion(currentQuestionIndex);
    console.log(`📍 Resumed at question ${currentQuestionIndex + 1}, current score: ${score}`);
  }
}

// Start quiz again from beginning
async function startAgain() {
  console.log('🔄 Starting quiz over');
  hideResumeModal();

  // Clear partial progress from DB
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  if (currentUser) {
    try {
      const { ipcRenderer } = require('electron');
      await ipcRenderer.invoke('quiz:clearPartial', {
        userId: currentUser.id,
        storyId: getStoryId(),
        quizNumber: 2
      });
    } catch (e) {
      console.error('Error clearing partial progress:', e);
    }
  }

  // Reset state
  currentQuestionIndex = 0;
  score = 0;
  userAnswers = [];

  // Go back to the START screen (intro) so the user sees the starting context/instructions again
  document.getElementById('quizQuestion').style.display = 'none';
  document.getElementById('quizIntro').style.display = 'block';
}

// For backward compatibility with story-viewer's continueGame
function startOver() {
  startAgain();
}

// Load story data and quiz
async function loadQuizData() {
    const storyId = getStoryId();
    
    try {
        const response = await fetch(`../../data/stories/story-${storyId}.json`);
        if (!response.ok) {
            throw new Error('Story not found');
        }
        storyData = await response.json();
        quizData = storyData.quiz2; // Decode the Word is quiz2
        
        console.log('Quiz loaded:', quizData.title);
        console.log('Questions:', quizData.questions.length);
        
        document.getElementById('totalQuestions').textContent = quizData.questions.length;

        // Check for saved partial progress in DB
        const savedProgress = await getSavedQuizProgress();
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

// Start the quiz
function startDecodeWord() {
    // Hide intro, show quiz
    document.getElementById('quizIntro').style.display = 'none';
    document.getElementById('quizQuestion').style.display = 'block';
    
    // Load first question
    loadQuestion(0);
}

// Load a specific question
function loadQuestion(index) {
    if (!quizData || index >= quizData.questions.length) {
        return;
    }
    
    currentQuestionIndex = index;
    const question = quizData.questions[index];
    
    // Update question counter
    document.getElementById('currentQuestion').textContent = index + 1;
    
    // Format the sentence with underlined word
    const sentenceWithUnderline = formatSentenceWithUnderline(
        question.question, 
        question.underlinedWord
    );
    
    // Display sentence and question prompt
    document.getElementById('sentenceText').innerHTML = sentenceWithUnderline;
    document.getElementById('questionPrompt').textContent = question.questionPrompt;
    
    // Create answer buttons
    const buttonsContainer = document.getElementById('answerButtons');
    buttonsContainer.innerHTML = '';
    
    question.options.forEach((option, idx) => {
        const button = document.createElement('button');
        
        // CHANGED CLASS TO answer-btn (The long style)
        button.className = 'answer-btn'; 

        const choices = idx;
        button.textContent = `${String(option).toLowerCase()}`;
        
        button.onclick = () => checkAnswer(idx);
        buttonsContainer.appendChild(button);
    });
    
    // Hide feedback message
    document.getElementById('feedbackMessage').style.display = 'none';
}

// Format sentence with underlined word
function formatSentenceWithUnderline(sentence, wordToUnderline) {
    // Case-insensitive search and replace with underlined version
    const regex = new RegExp(`\\b${wordToUnderline}\\b`, 'gi');
    
    return sentence.replace(regex, (match) => {
        return `<span style="text-decoration: underline; text-decoration-thickness: 2px; text-decoration-color: #ffffff; font-weight: 700;">${match}</span>`;
    });
}

// Check if answer is correct
function checkAnswer(selectedIndex) {
    const question = quizData.questions[currentQuestionIndex];
    const isCorrect = selectedIndex === question.correctAnswer;
    
    // Update score
    if (isCorrect) {
        score++;
    }
    
    // Store answer
    userAnswers.push({
        questionIndex: currentQuestionIndex,
        selectedIndex: selectedIndex,
        correct: isCorrect
    });

    // Save progress to localStorage
    saveQuizProgress(currentQuestionIndex, score, userAnswers);
    
    console.log('Stored answer:', {questionIndex: currentQuestionIndex, selectedIndex, correct: isCorrect, correctAnswer: question.correctAnswer});

    // Show feedback
    showFeedback(isCorrect, question.explanation);
    
    // Disable all buttons and show visual feedback
        const buttons = document.querySelectorAll('#answerButtons .answer-btn');    buttons.forEach((btn, idx) => {
        btn.disabled = true;
        btn.style.cursor = 'not-allowed';
        
        if (idx === question.correctAnswer) {
            // Correct answer - green
            btn.style.background = '#4ade80';
            btn.style.border = '3px solid #22c55e';
            btn.style.color = 'white';
            btn.style.transform = 'scale(1.05)';
        } else if (idx === selectedIndex && !isCorrect) {
            // Wrong selection - red
            btn.style.background = '#ef4444';
            btn.style.border = '3px solid #dc2626';
            btn.style.color = 'white';
        } else {
            // Other options - fade out
            btn.style.opacity = '0.4';
        }
    });
    
    // Continue after delay
    setTimeout(() => {
        if (currentQuestionIndex < quizData.questions.length - 1) {
            loadQuestion(currentQuestionIndex + 1);
        } else {
            finishQuiz();
        }
    }, 3000); // 3 seconds to read feedback
}

// Show feedback message
function showFeedback(isCorrect, explanation) {
    const feedbackElement = document.getElementById('feedbackMessage');
    
    if (isCorrect) {
        feedbackElement.innerHTML = `
            <div style="color: #ffffff;">
                <div style="font-size: 2rem; margin-bottom: 10px;">✓</div>
                <div style="font-size: 2.3rem;">Correct!</div>
                <div style="font-size: 1.8rem; margin-top: 10px; font-weight: normal; opacity: 0.9;">
                    ${explanation}
                </div>
            </div>
        `;
        feedbackElement.style.background = 'rgba(74, 222, 128, 0.2)';
        feedbackElement.style.border = '2px solid #4ade80';
    } else {
        feedbackElement.innerHTML = `
            <div style="color: #ffffff;">
                <div style="font-size: 2rem; margin-bottom: 10px;">✗</div>
                <div style="font-size: 2.3rem;">Not quite!</div>
                <div style="font-size: 1.8rem; margin-top: 10px; font-weight: normal; opacity: 0.9;">
                    ${explanation}
                </div>
            </div>
        `;
        feedbackElement.style.background = 'rgba(239, 68, 68, 0.2)';
        feedbackElement.style.border = '2px solid #ef4444';
    }
    
    feedbackElement.style.display = 'block';
}

// Calculate badge type based on score
// Quiz 2: perfect score = gold, anything less = bronze
function calculateBadgeType(score, total) {
    return score === total ? 'gold' : 'bronze';
}

// Finish quiz
async function finishQuiz() {
    const badgeType = calculateBadgeType(score, quizData.questions.length);
    const storyId = getStoryId();
    
    // Clear partial progress from DB since quiz is complete (saveQuizResults also clears via DB method)
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (currentUser) {
        try {
            const { ipcRenderer } = require('electron');
            await ipcRenderer.invoke('quiz:clearPartial', {
                userId: currentUser.id,
                storyId: storyId,
                quizNumber: 2
            });
        } catch (e) {
            console.error('Error clearing partial progress on finish:', e);
        }
    }
    
    // Store quiz results with badge type
    sessionStorage.setItem('quiz2Results', JSON.stringify({
        score: score,
        total: quizData.questions.length,
        percentage: Math.round((score / quizData.questions.length) * 100),
        badgeType: badgeType,
        answers: userAnswers
    }));
    
    // Save quiz results to database
    saveQuizResults(badgeType);
    
    // Go to result page (quiz 2 complete)
    window.location.href = `game-result.html?story=${storyId}&quiz=2`;
}

// Save quiz results to database
async function saveQuizResults(badgeType) {
    try {
        const { ipcRenderer } = require('electron');
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const storyId = getStoryId();
        
        if (currentUser) {
            // Save quiz result score only — badge:upgrade in game-result.js handles the badge
            await ipcRenderer.invoke('quiz:save', {
                userId: currentUser.id,
                storyId: storyId,
                quizNumber: 2,
                score: score,
                totalQuestions: quizData.questions.length,
                badgeType: badgeType
            });
            
            console.log(`Quiz 2 results saved (${badgeType})`);
        }
    } catch (error) {
        console.error('Error saving quiz results:', error);
    }
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', loadQuizData);