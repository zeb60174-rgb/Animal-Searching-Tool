// script.js — complete animal fetch with voice + wikipedia + multilingual names

// DOM elements
const inputField = document.getElementById('animalInput');
const searchBtn = document.getElementById('searchBtn');
const micBtn = document.getElementById('micBtn');
const voiceHint = document.getElementById('voiceHint');
const loading = document.getElementById('loading');
const resultCard = document.getElementById('resultContainer');
const errorMsg = document.getElementById('errorMessage');
const errorSpan = errorMsg.querySelector('span');

// result fields
const animalImage = document.getElementById('animalImage');
const animalName = document.getElementById('animalName');
const scientificNameSpan = document.getElementById('scientificName');
const descriptionDiv = document.getElementById('description');
const familyValue = document.getElementById('familyValue');
const dietValue = document.getElementById('dietValue');
const translationsList = document.getElementById('translationsList');

// AbortController for fetch cancellation
let currentController = null;

// ---------- voice recognition setup ----------
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
}

micBtn.addEventListener('click', () => {
    if (!recognition) {
        voiceHint.textContent = '❌ Voice recognition not supported in this browser. Try Chrome or Edge.';
        return;
    }
    voiceHint.textContent = '🎤 Listening... speak animal name.';
    micBtn.classList.add('listening');
    recognition.start();

    recognition.onresult = (event) => {
        const spoken = event.results[0][0].transcript;
        inputField.value = spoken;
        voiceHint.textContent = `✅ Heard: "${spoken}" — searching...`;
        micBtn.classList.remove('listening');
        performSearch(spoken);
    };

    recognition.onerror = (e) => {
        voiceHint.textContent = `⚠️ Voice error: ${e.error}`;
        micBtn.classList.remove('listening');
    };

    recognition.onend = () => {
        micBtn.classList.remove('listening');
        if (!voiceHint.textContent.includes('✅')) {
            voiceHint.textContent = '⏹️ Stopped listening.';
        }
    };
});

// ---------- search trigger ----------
searchBtn.addEventListener('click', () => {
    const query = inputField.value.trim();
    if (!query) {
        showError('Please type an animal name');
        return;
    }
    performSearch(query);
});

inputField.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchBtn.click();
    }
});

// ---------- main search function ----------
async function performSearch(animal) {
    // cancel previous ongoing request
    if (currentController) {
        currentController.abort();
    }
    currentController = new AbortController();
    const signal = currentController.signal;

    // reset UI
    hideError();
    resultCard.classList.add('hidden');
    loading.classList.remove('hidden');
    translationsList.innerHTML = '';
    familyValue.innerText = '';
    dietValue.innerText = '';
    scientificNameSpan.innerText = '';

    try {
        // 1. fetch Wikipedia summary (REST endpoint)
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(animal)}`;
        const summaryResp = await fetch(summaryUrl, { signal });
        if (!summaryResp.ok) {
            if (summaryResp.status === 404) throw new Error(`No Wikipedia page for "${animal}"`);
            else throw new Error(`Wikipedia error (${summaryResp.status})`);
        }
        const summaryData = await summaryResp.json();

        // handle disambiguation / missing
        if (summaryData.type === 'disambiguation') {
            throw new Error(`"${animal}" is ambiguous. Try a more specific name (e.g. "African lion")`);
        }
        if (!summaryData.title || summaryData.title.includes('(disambiguation)')) {
            throw new Error(`No clear article for "${animal}"`);
        }

        // 2. get normalized title from summary, then fetch langlinks
        const pageTitle = summaryData.title;
        const langUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=langlinks&lllimit=100&format=json&origin=*`;
        const langResp = await fetch(langUrl, { signal });
        const langData = await langResp.json();
        const pages = langData.query.pages;
        const pageId = Object.keys(pages)[0];
        const langlinks = pages[pageId].langlinks || [];

        // 3. populate UI with summary data
        animalName.innerText = summaryData.title;
        // scientific name from first sentence (e.g. "Lion (Panthera leo) ...")
        const extract = summaryData.extract || 'No description available.';
        descriptionDiv.innerHTML = `<p>${extract}</p>`;

        // try to extract scientific name from parentheses near start
        const sciMatch = extract.match(/^[^(]*\(([^)]+)\)/);
        if (sciMatch) {
            scientificNameSpan.innerText = sciMatch[1];
        } else {
            scientificNameSpan.innerText = '—';
        }

        // image
        if (summaryData.originalimage) {
            animalImage.src = summaryData.originalimage.source;
        } else if (summaryData.thumbnail) {
            animalImage.src = summaryData.thumbnail.source;
        } else {
            animalImage.src = 'https://upload.wikimedia.org/wikipedia/commons/6/64/Animal_diversity_placeholder.png'; // placeholder
        }

        // try to extract family & diet from extract (simple keywords)
        const lower = extract.toLowerCase();
        const familyMatch = lower.match(/\b(family|familia)\s+([a-z]+idae)\b/i);
        if (familyMatch) {
            familyValue.innerText = familyMatch[2];
        } else {
            // fallback: check if 'Felidae' etc appears
            const possible = extract.match(/([A-Z][a-z]+idae)/);
            familyValue.innerText = possible ? possible[1] : 'data in description';
        }

        if (lower.includes('carnivor') || lower.includes('predator') || lower.includes('meat')) {
            dietValue.innerText = 'carnivore (inferred)';
        } else if (lower.includes('herbivor') || lower.includes('plant') || lower.includes('grass')) {
            dietValue.innerText = 'herbivore (inferred)';
        } else if (lower.includes('omnivor')) {
            dietValue.innerText = 'omnivore (inferred)';
        } else {
            dietValue.innerText = '—';
        }

        // 4. build translation chips (language + name)
        if (langlinks.length === 0) {
            translationsList.innerHTML = '<div class="translation-chip">no other language links found</div>';
        } else {
            // we want to highlight Urdu, English, and as many as possible
            // english is original title, add manually
            const englishChip = document.createElement('div');
            englishChip.className = 'translation-chip';
            englishChip.innerHTML = `<strong>en</strong> ${summaryData.title}`;
            translationsList.appendChild(englishChip);

            // map language codes to names (small set for better display)
            const langMap = {
                ur: 'Urdu', hi: 'Hindi', ar: 'Arabic', fr: 'French', es: 'Spanish',
                de: 'German', zh: 'Chinese', ru: 'Russian', ja: 'Japanese', pt: 'Portuguese',
                bn: 'Bengali', pa: 'Punjabi', ta: 'Tamil', te: 'Telugu', tr: 'Turkish'
            };

            langlinks.slice(0, 24).forEach(link => {
                const code = link.lang;
                const nativeName = link['*']; // the translated title
                const displayLang = langMap[code] || code.toUpperCase();

                const chip = document.createElement('div');
                chip.className = 'translation-chip';
                chip.innerHTML = `<strong>${displayLang}</strong> ${nativeName}`;
                translationsList.appendChild(chip);
            });
        }

        // show result
        resultCard.classList.remove('hidden');
    } catch (err) {
        if (err.name === 'AbortError') {
            console.log('previous request aborted');
            return;
        }
        showError(err.message || 'Failed to fetch animal data');
    } finally {
        loading.classList.add('hidden');
        currentController = null;
    }
}

// helpers
function showError(text) {
    errorSpan.innerText = text;
    errorMsg.classList.remove('hidden');
    loading.classList.add('hidden');
    resultCard.classList.add('hidden');
}

function hideError() {
    errorMsg.classList.add('hidden');
}