// book-stories.js - Interactive vocabulary word definitions

let currentVocabAudio = null; // Track vocabulary audio

window.showDefinition = function showDefinition(word, phonetic, synonym, meaning, audioPath = '') {
    const card = document.getElementById('definition-card');
    const overlay = document.getElementById('overlay');
    
    // Update content
    document.getElementById('defTitle').textContent = word;
    document.getElementById('defPhonetic').textContent = phonetic;
    document.getElementById('defSynonym').textContent = synonym;
    document.getElementById('defMeaning').textContent = meaning;
    
    // Store audio path in a data attribute for the play button to use
    if (audioPath) {
        card.setAttribute('data-audio-path', audioPath);
    } else {
        card.removeAttribute('data-audio-path');
    }
    
    // Show card and overlay
    card.classList.add('active');
    overlay.classList.add('active');
}

window.hideDefinition = function hideDefinition() {
    const card = document.getElementById('definition-card');
    const overlay = document.getElementById('overlay');
    
    // Stop any playing vocab audio
    stopVocabAudio();
    
    // Hide card and overlay
    card.classList.remove('active');
    overlay.classList.remove('active');
}

window.playAudio = function playAudio() {
    const card = document.getElementById('definition-card');
    const audioPath = card.getAttribute('data-audio-path');
    
    if (!audioPath) {
        console.log('No audio path available for this vocabulary word');
        return;
    }
    
    // Stop any currently playing vocab audio
    stopVocabAudio();
    
    // Create and play new audio
    currentVocabAudio = new Audio('../../' + audioPath);
    const volume = parseInt(localStorage.getItem('volume') || '70') / 100;
    currentVocabAudio.volume = volume;
    
    currentVocabAudio.play().catch(error => {
        console.error('Error playing vocabulary audio:', error);
    });
    
    // Clean up when audio ends
    currentVocabAudio.addEventListener('ended', () => {
        currentVocabAudio = null;
    });
}

function stopVocabAudio() {
    if (currentVocabAudio) {
        currentVocabAudio.pause();
        currentVocabAudio.currentTime = 0;
        currentVocabAudio = null;
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopVocabAudio();
});