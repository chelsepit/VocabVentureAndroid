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
        button.className = 'start-button';
        
        // Format as A., B., C.
        const letter = String.fromCharCode(65 + idx); // 65 is 'A' in ASCII
        button.textContent = `${letter}. ${option}`;
        
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
        return `<span style="text-decoration: underline; text-decoration-thickness: 2px; text-decoration-color: #FF6B35; font-weight: 700;">${match}</span>`;
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
    
    // Show feedback
    showFeedback(isCorrect, question.explanation);
    
    // Disable all buttons and show visual feedback
    const buttons = document.querySelectorAll('#answerButtons .start-button');
    buttons.forEach((btn, idx) => {
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
            <div style="color: #16a34a;">
                <div style="font-size: 2rem; margin-bottom: 10px;">✓</div>
                <div style="font-size: 1.3rem;">Correct!</div>
                <div style="font-size: 1rem; margin-top: 10px; font-weight: normal; opacity: 0.9;">
                    ${explanation}
                </div>
            </div>
        `;
        feedbackElement.style.background = 'rgba(74, 222, 128, 0.2)';
        feedbackElement.style.border = '2px solid #4ade80';
    } else {
        feedbackElement.innerHTML = `
            <div style="color: #dc2626;">
                <div style="font-size: 2rem; margin-bottom: 10px;">✗</div>
                <div style="font-size: 1.3rem;">Not quite!</div>
                <div style="font-size: 1rem; margin-top: 10px; font-weight: normal; opacity: 0.9;">
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
function calculateBadgeType(score, total) {
    if (score === total) {
        return 'gold';
    } else if (score >= 3 && score <= 4) {
        return 'silver';
    } else {
        return 'bronze';
    }
}

// Finish quiz
function finishQuiz() {
    const badgeType = calculateBadgeType(score, quizData.questions.length);
    
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
    const storyId = getStoryId();
    window.location.href = `game-result.html?story=${storyId}&quiz=2`;
}

// Save quiz results to database
async function saveQuizResults(badgeType) {
    try {
        const { ipcRenderer } = require('electron');
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const storyId = getStoryId();
        
        if (currentUser) {
            // Save quiz result with badge type
            await ipcRenderer.invoke('quiz:save', {
                userId: currentUser.id,
                storyId: storyId,
                quizNumber: 2,
                score: score,
                totalQuestions: quizData.questions.length,
                badgeType: badgeType
            });
            
            // Award badge for Quiz 2
            await ipcRenderer.invoke('badge:award', {
                userId: currentUser.id,
                storyId: storyId,
                badgeType: badgeType,
                badgeCategory: 'quiz-2'
            });
            
            console.log(`Quiz 2 results saved - ${badgeType} badge awarded`);
        }
    } catch (error) {
        console.error('Error saving quiz results:', error);
    }
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', loadQuizData);