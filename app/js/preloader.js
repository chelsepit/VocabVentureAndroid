// preloader.js - Shared Image Preloader for All Pages
// ⚡ Drop this into the <head> of each page BEFORE any other scripts or CSS:
// <script src="../../assets/js/preloader.js"></script>

(function () {

    // ============================================
    // EXACT PATHS FROM YOUR CSS FILES
    // These match what's actually referenced in each page's CSS
    // ============================================
    const PAGE_ASSETS = {
        // welcome-page.css → url('../assets/images/backgrounds/welcome.svg')
        'welcome': [
            '../../assets/images/backgrounds/welcome.svg',
        ],
        'welcome-auth': [
            '../../assets/images/backgrounds/welcome.svg',
        ],

        // auth.css → url('../assets/images/backgrounds/auth-bg.svg')
        'login': [
            '../../assets/images/backgrounds/auth-bg.svg',
        ],
        'register': [
            '../../assets/images/backgrounds/auth-bg.svg',
        ],

        // stories.css → url('../assets/images/backgrounds/library-bg.png')
        'library': [
            '../../assets/images/backgrounds/library-bg.png',
        ],
        'personal-library': [
            '../../assets/images/backgrounds/library-bg.png',
        ],

        // badge.css → url('../assets/images/backgrounds/library-bg.png')
        'badges': [
            '../../assets/images/backgrounds/library-bg.png',
            '../../assets/images/badges/gold-badge.png',
            '../../assets/images/badges/silver-badge.png',
            '../../assets/images/badges/bronze-badge.png',
            '../../assets/images/badges/locked-badge.png',
        ],

        // finish-book.css → url('../assets/images/backgrounds/game-bg.svg')
        'finish-book': [
            '../../assets/images/backgrounds/game-bg.svg',
            '../../assets/images/badges/bronze-badge.png',
        ],

        // game-result.css → url('../assets/images/backgrounds/game-bg.svg')
        'game-result': [
            '../../assets/images/backgrounds/game-bg.svg',
            '../../assets/images/badges/gold-badge.png',
            '../../assets/images/badges/silver-badge.png',
            '../../assets/images/badges/bronze-badge.png',
        ],

        // decode-the-world.css / decode-the-world-game.css → url('../assets/images/backgrounds/game-bg.svg')
        'decode-the-word': [
            '../../assets/images/backgrounds/game-bg.svg',
        ],

        // pick-a-word-quiz.css / pick-a-world.css → url('../assets/images/backgrounds/game-bg.svg')
        'pick-a-word': [
            '../../assets/images/backgrounds/game-bg.svg',
        ],

        // lets-review.css → url('../assets/images/backgrounds/game-bg.svg')
        'lets-review': [
            '../../assets/images/backgrounds/game-bg.svg',
        ],
    };

    // ============================================
    // DETECT CURRENT PAGE FROM FILENAME
    // ============================================
    function getCurrentPage() {
        const path = window.location.pathname;
        return path.split('/').pop().replace('.html', '');
    }

    // ============================================
    // INJECT <link rel="preload"> INTO <head>
    // This is the fastest method — higher browser priority
    // than new Image(), and crucially it also primes the
    // cache for CSS background-image (new Image() doesn't)
    // ============================================
    function injectPreloadLinks(paths) {
        paths.forEach(src => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = src;
            document.head.appendChild(link);
        });
    }

    // ============================================
    // PRELOAD PICK-A-WORD QUIZ IMAGES
    // Fetches story JSON and preloads every question's
    // image upfront so there's zero wait per question
    // ============================================
    async function preloadPickAWordImages() {
        const urlParams = new URLSearchParams(window.location.search);
        const storyId = parseInt(
            urlParams.get('story') ||
            sessionStorage.getItem('quizStoryId') ||
            '1'
        );

        try {
            const response = await fetch(`../../data/stories/story-${storyId}.json`);
            if (!response.ok) return;

            const storyData = await response.json();
            const quiz1 = storyData.quiz1;
            if (!quiz1 || !quiz1.questions) return;

            const imagePaths = quiz1.questions.map(q => {
                const correctWord = q.options[q.correctAnswer];
                return `../../assets/images/pick-a-word/story${storyId}-pick-a-word/${correctWord.toLowerCase().replace(/\s+/g, '')}.png`;
            });

            console.log(`⚡ Preloading ${imagePaths.length} pick-a-word images for story ${storyId}`);
            injectPreloadLinks(imagePaths);

        } catch (err) {
            console.warn('⚠️ Could not preload pick-a-word images:', err.message);
        }
    }

    // ============================================
    // MAIN — runs immediately when script tag is parsed,
    // before CSS is applied, so backgrounds are already
    // in cache by the time they're needed
    // ============================================
    function preloadPageAssets() {
        const page = getCurrentPage();
        console.log(`⚡ Preloader running for page: ${page}`);

        const knownAssets = PAGE_ASSETS[page] || [];
        if (knownAssets.length > 0) {
            injectPreloadLinks(knownAssets);
            console.log(`⚡ Preloaded ${knownAssets.length} assets for "${page}"`);
        }

        // Pick-a-word needs dynamic image preloading from story JSON
        if (page === 'pick-a-word') {
            preloadPickAWordImages(); // async, non-blocking
        }
    }

    preloadPageAssets();

})();