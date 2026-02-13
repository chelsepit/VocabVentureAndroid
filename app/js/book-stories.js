function showDefinition(word, phonetic, synonym, meaning) {
    const card = document.getElementById('definition-card');
    const overlay = document.getElementById('overlay');
    
    // Update content
    document.getElementById('defTitle').textContent = word;
    document.getElementById('defPhonetic').textContent = phonetic;
    document.getElementById('defSynonym').textContent = synonym;
    document.getElementById('defMeaning').textContent = meaning;
    
    // Show card and overlay
    card.classList.add('active');
    overlay.classList.add('active');
}

function hideDefinition() {
    const card = document.getElementById('definition-card');
    const overlay = document.getElementById('overlay');
    
    // Hide card and overlay
    card.classList.remove('active');
    overlay.classList.remove('active');
}

function playAudio() {
    // Get the current word
    const word = document.getElementById('defTitle').textContent;
    
    
}