// pick-a-word-quiz.js - Pic-a-Word Quiz Logic with Badge System

let storyData = null;
let quizData = null;
let currentQuestionIndex = 0;
let score = 0;
let userAnswers = [];

// Get story ID
function getStoryId() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlStoryId = urlParams.get("story");
  const sessionStoryId = sessionStorage.getItem("quizStoryId");

  return parseInt(urlStoryId || sessionStoryId) || 1;
}

// Check for saved quiz progress
function getSavedQuizProgress() {
  const storyId = getStoryId();
  const savedProgress = localStorage.getItem(`quiz1_progress_${storyId}`);
  if (savedProgress) {
    try {
      return JSON.parse(savedProgress);
    } catch (e) {
      console.error('Error parsing saved progress:', e);
      return null;
    }
  }
  return null;
}

// Save quiz progress to localStorage
function saveQuizProgress(questionIndex, score, answers) {
  const storyId = getStoryId();
  localStorage.setItem(`quiz1_progress_${storyId}`, JSON.stringify({
    questionIndex: questionIndex,
    score: score,
    answers: answers,
    timestamp: Date.now()
  }));
  console.log(`📊 Quiz 1 progress saved - Question ${questionIndex + 1}, Score: ${score}`);
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
function continueGame() {
  console.log('▶️ Resuming quiz from saved progress');
  hideResumeModal();
  
  const savedProgress = getSavedQuizProgress();
  if (savedProgress && quizData) {
    currentQuestionIndex = savedProgress.questionIndex;
    score = savedProgress.score;
    userAnswers = savedProgress.answers;
    
    // Show quiz screen
    document.getElementById('quizIntro').style.display = 'none';
    document.getElementById('quizQuestion').style.display = 'block';
    
    // Load the next unanswered question
    loadQuestion(currentQuestionIndex);
    console.log(`📍 Resumed at question ${currentQuestionIndex + 1}, current score: ${score}`);
  }
}

// Start quiz again from beginning
function startAgain() {
  console.log('🔄 Starting quiz over');
  hideResumeModal();

  const storyId = getStoryId();
  localStorage.removeItem(`quiz1_progress_${storyId}`);

  // Reset state
  currentQuestionIndex = 0;
  score = 0;
  userAnswers = [];

  // Go back to the START screen (intro) so the user sees the starting picture/prompt again
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
      throw new Error("Story not found");
    }
    storyData = await response.json();
    quizData = storyData.quiz1; // Pic-a-Word is quiz1

    console.log("Quiz loaded:", quizData.title);
    console.log("Questions:", quizData.questions.length);

    document.getElementById("totalQuestions").textContent =
      quizData.questions.length;

    // Check for saved progress
    const savedProgress = getSavedQuizProgress();
    if (savedProgress && savedProgress.questionIndex < quizData.questions.length) {
      console.log('🔄 Found saved quiz progress - showing resume modal');
      showQuizResumeModal(savedProgress);
    }
  } catch (error) {
    console.error("Error loading quiz:", error);
    alert("Failed to load quiz. Redirecting to library...");
    window.location.href = "library.html";
  }
}

// Start the quiz
function startPicAWord() {
  // Hide intro, show quiz
  document.getElementById("quizIntro").style.display = "none";
  document.getElementById("quizQuestion").style.display = "block";

  // Load first question
  loadQuestion(0);
}

// Load a specific question
// Load a specific question
function loadQuestion(index) {
    if (!quizData || index >= quizData.questions.length) {
        return;
    }

    currentQuestionIndex = index;
    const question = quizData.questions[index];

    // Update question counter
    document.getElementById("currentQuestion").textContent = index + 1;

    // 1. GET IMAGE PATH
    const correctWord = question.options[question.correctAnswer];
    const storyId = getStoryId();
    // Build image path based on correct answer
    const imagePath = `../../assets/images/pick-a-word/story${storyId}-pick-a-word/${correctWord.toLowerCase().replace(/\s+/g, "")}.png`;

    // 2. SET THE IMAGE (Top Container)
    const imgElement = document.getElementById("mainQuizImage");
    imgElement.src = imagePath;
    
    // Add error handling for the image
    imgElement.onerror = function() {
        this.src = '../../assets/images/icons/question-mark-icon.svg'; 
        console.error('Image not found:', imagePath);
    };

    // 3. SET THE TEXT (Below Container)
    // We do NOT split the string anymore. We just show the question with the blanks.
    document.getElementById("questionText").innerHTML = question.question;

    // 4. CREATE BUTTONS
    const buttonsContainer = document.getElementById("answerButtons");
    buttonsContainer.innerHTML = "";

    question.options.forEach((option, idx) => {
        const button = document.createElement("button");
        button.className = "start-button";
     
        button.textContent = `${option}`;

        button.onclick = () => checkAnswer(idx);
        buttonsContainer.appendChild(button);
    });

    // Hide feedback message
    document.getElementById("feedbackMessage").style.display = "none";
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
    correct: isCorrect,
  });

  // Save progress to localStorage
  saveQuizProgress(currentQuestionIndex, score, userAnswers);

  // Show feedback
  showFeedback(isCorrect, question.explanation);

  // Disable all buttons and show visual feedback
  const buttons = document.querySelectorAll("#answerButtons .start-button");
  buttons.forEach((btn, idx) => {
    btn.disabled = true;
    btn.style.cursor = "not-allowed";

    if (idx === question.correctAnswer) {
      // Correct answer - green
      btn.style.background = "#4ade80";
      btn.style.border = "3px solid #22c55e";
      btn.style.color = "white";
      btn.style.transform = "scale(1.05)";
    } else if (idx === selectedIndex && !isCorrect) {
      // Wrong selection - red
      btn.style.background = "#ef4444";
      btn.style.border = "3px solid #dc2626";
      btn.style.color = "white";
    } else {
      // Other options - fade out
      btn.style.opacity = "0.4";
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
  const feedbackElement = document.getElementById("feedbackMessage");

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
    feedbackElement.style.background = "rgba(74, 222, 128, 0.2)";
    feedbackElement.style.border = "2px solid #4ade80";
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
    feedbackElement.style.background = "rgba(239, 68, 68, 0.2)";
    feedbackElement.style.border = "2px solid #ef4444";
  }

  feedbackElement.style.display = "block";
}

// Calculate badge type based on score
function calculateBadgeType(score, total) {
  if (score === total) {
    return "gold";
  } else if (score >= 3 && score <= 4) {
    return "silver";
  } else {
    return "bronze";
  }
}

// Finish quiz
function finishQuiz() {
  const badgeType = calculateBadgeType(score, quizData.questions.length);
  const storyId = getStoryId();

  // Clear saved progress since quiz is complete
  localStorage.removeItem(`quiz1_progress_${storyId}`);

  // Store quiz results with badge type
  sessionStorage.setItem(
    "quiz1Results",
    JSON.stringify({
      score: score,
      total: quizData.questions.length,
      percentage: Math.round((score / quizData.questions.length) * 100),
      badgeType: badgeType,
      answers: userAnswers,
    }),
  );

  // Save quiz results to database
  saveQuizResults(badgeType);

  // Go to result page
  window.location.href = `game-result.html?story=${storyId}&quiz=1`;
}

// Save quiz results to database
async function saveQuizResults(badgeType) {
  try {
    const { ipcRenderer } = require("electron");
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    const storyId = getStoryId();

    if (currentUser) {
      // Save quiz result with badge type
      await ipcRenderer.invoke("quiz:save", {
        userId: currentUser.id,
        storyId: storyId,
        quizNumber: 1,
        score: score,
        totalQuestions: quizData.questions.length,
        badgeType: badgeType,
      });

      // Award badge for Quiz 1
      await ipcRenderer.invoke("badge:award", {
        userId: currentUser.id,
        storyId: storyId,
        badgeType: badgeType,
        badgeCategory: "quiz-1",
      });

      console.log(`Quiz 1 results saved - ${badgeType} badge awarded`);
    }
  } catch (error) {
    console.error("Error saving quiz results:", error);
  }
}

// Initialize when page loads
window.addEventListener("DOMContentLoaded", loadQuizData);