// API endpoints
const WIKIPEDIA_API = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const WIKIMEDIA_API = 'https://commons.wikimedia.org/w/api.php';

// DOM elements
const input = document.getElementById('animalInput');
const searchBtn = document.getElementById('searchBtn');
const suggestionsDiv = document.getElementById('suggestions');
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const errorMsg = document.getElementById('errorMsg');
const retryBtn = document.getElementById('retryBtn');
const resultDiv = document.getElementById('result');
const animalImage = document.getElementById('animalImage');
const imageCredit = document.getElementById('imageCredit');
const animalNameSpan = document.getElementById('animalName');
const scientificNameSpan = document.getElementById('scientificName');
const groupSpan = document.getElementById('group');
const habitatSpan = document.getElementById('habitat');
const dietSpan = document.getElementById('diet');
const locationSpan = document.getElementById('location');
const functionalityP = document.getElementById('functionality');
const factsList = document.getElementById('facts');
const conservationBadge = document.getElementById('conservationBadge');
const popularTags = document.getElementById('popularTags');

// A broad list of common animals for suggestions
const commonAnimals = [
    'Lion', 'Tiger', 'Elephant', 'Giraffe', 'Zebra', 'Cheetah', 'Leopard',
    'Rhino', 'Hippo', 'Gorilla', 'Chimpanzee', 'Orangutan', 'Kangaroo',
    'Koala', 'Panda', 'Polar bear', 'Brown bear', 'Wolf', 'Fox', 'Deer',
    'Eagle', 'Hawk', 'Owl', 'Parrot', 'Penguin', 'Flamingo', 'Peacock',
    'Snake', 'Lizard', 'Crocodile', 'Turtle', 'Frog', 'Salamander',
    'Shark', 'Dolphin', 'Whale', 'Octopus', 'Jellyfish', 'Starfish',
    'Butterfly', 'Bee', 'Ant', 'Beetle', 'Dragonfly'
];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    populatePopularTags();
    // Optional: show a random animal on load
    setTimeout(() => {
        const random = commonAnimals[Math.floor(Math.random() * commonAnimals.length)];
        input.value = random;
        searchAnimal(random);
    }, 300);
});

// Event listeners
searchBtn.addEventListener('click', () => searchAnimal(input.value.trim()));
input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchAnimal(input.value.trim());
});
input.addEventListener('input', () => showSuggestions(input.value.trim()));
retryBtn.addEventListener('click', () => searchAnimal(input.value.trim()));

// Close suggestions when clicking outside
document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !suggestionsDiv.contains(e.target)) {
        suggestionsDiv.style.display = 'none';
    }
});

// Populate popular tags
function populatePopularTags() {
    const shuffled = commonAnimals.sort(() => 0.5 - Math.random()).slice(0, 24);
    popularTags.innerHTML = '';
    shuffled.forEach(animal => {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = animal;
        tag.addEventListener('click', () => {
            input.value = animal;
            searchAnimal(animal);
        });
        popularTags.appendChild(tag);
    });
}

// Show suggestions as user types
function showSuggestions(query) {
    if (query.length < 2) {
        suggestionsDiv.style.display = 'none';
        return;
    }
    const matches = commonAnimals.filter(a =>
        a.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 6);
    if (matches.length === 0) {
        suggestionsDiv.style.display = 'none';
        return;
    }
    suggestionsDiv.innerHTML = '';
    matches.forEach(m => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.textContent = m;
        div.addEventListener('click', () => {
            input.value = m;
            searchAnimal(m);
            suggestionsDiv.style.display = 'none';
        });
        suggestionsDiv.appendChild(div);
    });
    suggestionsDiv.style.display = 'block';
}

// Main search function
async function searchAnimal(animal) {
    if (!animal) {
        showError('Please enter an animal name.');
        return;
    }

    // Hide previous result/error, show loading
    resultDiv.classList.add('hidden');
    errorDiv.classList.add('hidden');
    loadingDiv.classList.remove('hidden');

    try {
        // Fetch data from Wikipedia
        const wikiResponse = await fetch(`${WIKIPEDIA_API}${encodeURIComponent(animal)}`);
        if (!wikiResponse.ok) {
            throw new Error('Animal not found on Wikipedia');
        }
        const wikiData = await wikiResponse.json();

        // Fetch an image (priority: Wikipedia originalimage, then Wikimedia)
        let imageUrl = null;
        let credit = '';

        if (wikiData.originalimage && wikiData.originalimage.source) {
            imageUrl = wikiData.originalimage.source;
            credit = 'Wikipedia';
        } else {
            // Try Wikimedia
            const wikimediaImg = await fetchWikimediaImage(animal);
            if (wikimediaImg) {
                imageUrl = wikimediaImg.url;
                credit = wikimediaImg.credit;
            }
        }

        // If still no image, use a placeholder
        if (!imageUrl) {
            imageUrl = `https://via.placeholder.com/800x600?text=${encodeURIComponent(animal)}`;
            credit = 'Placeholder';
        }

        // Extract / infer information
        const name = formatName(animal);
        const scientific = wikiData.titles?.canonical || name;
        const group = determineGroup(wikiData, animal);
        const habitat = extractInfo(wikiData, 'habitat') || inferHabitat(animal);
        const diet = extractInfo(wikiData, 'diet') || inferDiet(animal);
        const location = extractInfo(wikiData, ['found in', 'native to', 'range']) || inferLocation(animal);
        const functionality = generateFunctionality(animal, group);
        const facts = extractFunFacts(wikiData) || generateFunFacts(animal);
        const conservation = determineConservation(wikiData, animal);

        // Update DOM
        animalImage.src = imageUrl;
        animalImage.alt = name;
        imageCredit.textContent = `📸 ${credit}`;
        animalNameSpan.textContent = name;
        scientificNameSpan.textContent = scientific;
        groupSpan.textContent = group;
        habitatSpan.textContent = habitat;
        dietSpan.textContent = diet;
        locationSpan.textContent = location;
        functionalityP.textContent = functionality;

        factsList.innerHTML = '';
        facts.slice(0, 4).forEach(f => {
            const li = document.createElement('li');
            li.textContent = f;
            factsList.appendChild(li);
        });

        conservationBadge.textContent = conservation;
        conservationBadge.setAttribute('data-status', conservation);

        // Show result
        resultDiv.classList.remove('hidden');
    } catch (err) {
        console.error(err);
        showError(`Sorry, we couldn't find information for "${animal}". Try a different name.`);
    } finally {
        loadingDiv.classList.add('hidden');
    }
}

// Helper: fetch an image from Wikimedia Commons
async function fetchWikimediaImage(animal) {
    const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        generator: 'search',
        gsrsearch: `${animal} animal -icon -logo -map -diagram`,
        gsrnamespace: '6',
        gsrlimit: '10',
        prop: 'imageinfo',
        iiprop: 'url|user',
        iiurlwidth: '800',
        origin: '*'
    });

    try {
        const response = await fetch(`${WIKIMEDIA_API}?${params}`);
        const data = await response.json();
        if (data.query && data.query.pages) {
            const pages = Object.values(data.query.pages);
            for (const page of pages) {
                if (page.imageinfo && page.imageinfo[0]) {
                    const info = page.imageinfo[0];
                    return {
                        url: info.thumburl || info.url,
                        credit: info.user || 'Wikimedia Commons'
                    };
                }
            }
        }
    } catch (e) {
        console.warn('Wikimedia fetch failed', e);
    }
    return null;
}

// Helper: extract a sentence containing a keyword from Wikipedia extract
function extractInfo(wikiData, keywords) {
    if (!wikiData.extract) return null;
    const extract = wikiData.extract;
    const words = Array.isArray(keywords) ? keywords : [keywords];
    for (const word of words) {
        const index = extract.toLowerCase().indexOf(word.toLowerCase());
        if (index !== -1) {
            const start = extract.lastIndexOf('.', index) + 1;
            const end = extract.indexOf('.', index);
            if (end !== -1) return extract.substring(start, end + 1).trim();
            else return extract.substring(start).trim();
        }
    }
    return null;
}

// Determine animal group from Wikipedia or fallback
function determineGroup(wikiData, animal) {
    const animalLower = animal.toLowerCase();
    // Quick check by common groups
    if (['mammal', 'mammalia'].some(g => wikiData.extract?.toLowerCase().includes(g))) return 'Mammal';
    if (['bird', 'aves'].some(g => wikiData.extract?.toLowerCase().includes(g))) return 'Bird';
    if (['reptile', 'reptilia'].some(g => wikiData.extract?.toLowerCase().includes(g))) return 'Reptile';
    if (['amphibian', 'amphibia'].some(g => wikiData.extract?.toLowerCase().includes(g))) return 'Amphibian';
    if (['fish', 'pisces'].some(g => wikiData.extract?.toLowerCase().includes(g))) return 'Fish';
    if (['insect', 'insecta'].some(g => wikiData.extract?.toLowerCase().includes(g))) return 'Insect';

    // Fallback by name
    const mammal = ['lion','tiger','elephant','bear','wolf','fox','deer','whale','dolphin','bat','kangaroo','koala','panda','gorilla','monkey'];
    const bird = ['eagle','hawk','owl','parrot','penguin','flamingo','peacock','sparrow','crow','raven'];
    const reptile = ['snake','lizard','crocodile','turtle','gecko','chameleon','alligator'];
    const amphibian = ['frog','toad','salamander','newt','axolotl'];
    const fish = ['shark','salmon','trout','tuna','goldfish','koi','catfish'];
    const insect = ['butterfly','bee','ant','beetle','dragonfly','grasshopper'];

    if (mammal.some(a => animalLower.includes(a))) return 'Mammal';
    if (bird.some(a => animalLower.includes(a))) return 'Bird';
    if (reptile.some(a => animalLower.includes(a))) return 'Reptile';
    if (amphibian.some(a => animalLower.includes(a))) return 'Amphibian';
    if (fish.some(a => animalLower.includes(a))) return 'Fish';
    if (insect.some(a => animalLower.includes(a))) return 'Insect';

    return 'Animal';
}

// Fallback habitat
function inferHabitat(animal) {
    const a = animal.toLowerCase();
    if (a.includes('whale') || a.includes('dolphin') || a.includes('shark') || a.includes('fish')) return 'Oceans, seas, and freshwater bodies';
    if (a.includes('eagle') || a.includes('hawk') || a.includes('owl')) return 'Forests, mountains, open country';
    if (a.includes('frog') || a.includes('salamander')) return 'Wetlands, forests, near water';
    return 'Terrestrial and aquatic habitats depending on the species';
}

// Fallback diet
function inferDiet(animal) {
    const a = animal.toLowerCase();
    const carnivores = ['lion','tiger','cheetah','leopard','wolf','eagle','hawk','owl','shark','snake','crocodile','dolphin','orca'];
    const herbivores = ['elephant','giraffe','zebra','deer','cow','sheep','goat','kangaroo','koala','panda','hippo','rhino'];
    if (carnivores.some(c => a.includes(c))) return 'Carnivore';
    if (herbivores.some(h => a.includes(h))) return 'Herbivore';
    return 'Omnivore (feeds on both plants and animals)';
}

// Fallback location
function inferLocation(animal) {
    const a = animal.toLowerCase();
    if (a.includes('kangaroo') || a.includes('koala') || a.includes('platypus')) return 'Australia and surrounding islands';
    if (a.includes('lion') || a.includes('elephant') || a.includes('giraffe') || a.includes('zebra')) return 'Africa';
    if (a.includes('tiger') || a.includes('panda') || a.includes('orangutan')) return 'Asia';
    if (a.includes('eagle') && !a.includes('bald')) return 'Worldwide, except Antarctica';
    if (a.includes('penguin')) return 'Southern Hemisphere, especially Antarctica';
    return 'Various continents depending on species';
}

// Generate functionality text based on group
function generateFunctionality(animal, group) {
    const base = `${animal}s play a crucial role in their ecosystem. `;
    switch (group) {
        case 'Mammal':
            return base + 'As mammals, they often help control prey populations, disperse seeds, or maintain vegetation balance. Their presence indicates a healthy habitat.';
        case 'Bird':
            return base + 'Birds are essential for pollination, seed dispersal, and insect control. They also serve as indicators of environmental quality.';
        case 'Reptile':
            return base + 'Reptiles help regulate populations of insects and small animals, and they themselves are prey for larger predators, forming a vital link in the food chain.';
        case 'Amphibian':
            return base + 'Amphibians are bioindicators – their sensitive skin reflects ecosystem health. They control insect populations and provide food for many other animals.';
        case 'Fish':
            return base + 'Fish maintain aquatic food webs, control algae, and cycle nutrients. They are a key food source for birds, mammals, and humans.';
        case 'Insect':
            return base + 'Insects pollinate plants, decompose organic matter, and are a fundamental food source for countless other species.';
        default:
            return base + 'This animal contributes to biodiversity and helps maintain ecological balance in its natural environment.';
    }
}

// Extract fun facts from Wikipedia or generate
function extractFunFacts(wikiData) {
    if (!wikiData.extract) return null;
    const sentences = wikiData.extract.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const interesting = sentences.filter(s =>
        s.toLowerCase().includes('interesting') ||
        s.toLowerCase().includes('unique') ||
        s.toLowerCase().includes('unusual') ||
        s.toLowerCase().includes('remarkable') ||
        s.toLowerCase().includes('special') ||
        s.toLowerCase().includes('only')
    );
    if (interesting.length >= 3) return interesting.slice(0, 4).map(s => s.trim() + '.');
    // Otherwise return first 3 sentences
    return sentences.slice(0, 4).map(s => s.trim() + '.');
}

function generateFunFacts(animal) {
    const facts = [
        `${animal}s have adapted to their environment over millions of years.`,
        `The study of ${animal}s helps scientists understand evolution and biodiversity.`,
        `${animal}s communicate using sounds, body language, and sometimes chemical signals.`,
        `Different species of ${animal}s can be found in diverse habitats across the globe.`,
        `${animal}s play specific roles in their ecosystems as predators, prey, or both.`
    ];
    return facts;
}

// Determine conservation status (simplified)
function determineConservation(wikiData, animal) {
    if (wikiData.extract) {
        const text = wikiData.extract.toLowerCase();
        if (text.includes('critically endangered')) return 'Critically Endangered';
        if (text.includes('endangered')) return 'Endangered';
        if (text.includes('vulnerable')) return 'Vulnerable';
        if (text.includes('near threatened')) return 'Near Threatened';
    }
    const a = animal.toLowerCase();
    if (['tiger','elephant','panda','rhino','orangutan','gorilla','leopard'].some(x => a.includes(x))) return 'Endangered';
    if (['lion','giraffe','hippo','polar bear','cheetah'].some(x => a.includes(x))) return 'Vulnerable';
    return 'Least Concern';
}

// Helper to format name
function formatName(name) {
    return name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

// Show error
function showError(msg) {
    errorMsg.textContent = msg;
    errorDiv.classList.remove('hidden');
    loadingDiv.classList.add('hidden');
    resultDiv.classList.add('hidden');
}