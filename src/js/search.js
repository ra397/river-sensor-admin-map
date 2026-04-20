let markerCollection = null;
let map = null;
let resultsContainer = null;

const SEARCH_PROPERTIES = ['name', 'sid', 'river', 'town'];
const MAX_RESULTS = 5;

function createResultsContainer() {
    const container = document.createElement('div');
    container.id = 'search-results';
    container.className = 'search-results';
    const input = document.getElementById('search-input');
    input.parentElement.appendChild(container);
    return container;
}

function scoreMatch(marker, query) {
    const q = query.toLowerCase();

    for (let i = 0; i < SEARCH_PROPERTIES.length; i++) {
        const prop = SEARCH_PROPERTIES[i];
        const value = marker.properties[prop];
        if (value == null) continue;

        const str = String(value).toLowerCase();
        if (str.startsWith(q)) {
            // Earlier properties get higher priority (lower score = better)
            return { score: i, matchType: 'starts', prop, value: String(marker.properties[prop]) };
        }
    }

    for (let i = 0; i < SEARCH_PROPERTIES.length; i++) {
        const prop = SEARCH_PROPERTIES[i];
        const value = marker.properties[prop];
        if (value == null) continue;

        const str = String(value).toLowerCase();
        if (str.includes(q)) {
            // Contains matches are scored after all startsWith matches
            return { score: SEARCH_PROPERTIES.length + i, matchType: 'contains', prop, value: String(marker.properties[prop]) };
        }
    }

    return null;
}

function search(query) {
    if (!query || query.trim() === '') {
        return [];
    }

    const results = [];

    for (const marker of markerCollection.markers) {
        const match = scoreMatch(marker, query.trim());
        if (match) {
            results.push({ marker, ...match });
        }
    }

    // Sort by score (lower is better)
    results.sort((a, b) => a.score - b.score);

    return results.slice(0, MAX_RESULTS);
}

function renderResults(results) {
    resultsContainer.innerHTML = '';

    if (results.length === 0) {
        resultsContainer.classList.remove('visible');
        return;
    }

    for (const result of results) {
        const item = document.createElement('div');
        item.className = 'search-result-item';

        const name = result.marker.properties.name || 'Unknown';
        const matchInfo = result.prop !== 'name' ? ` (${result.prop}: ${result.value})` : '';
        item.textContent = name + matchInfo;

        item.addEventListener('click', () => {
            zoomToMarker(result.marker);
            clearSearch();
        });

        resultsContainer.appendChild(item);
    }

    resultsContainer.classList.add('visible');
}

function zoomToMarker(markerObj) {
    const pos = markerObj.marker.getPosition();
    map.setCenter(pos);
    map.setZoom(14);
}

function clearSearch() {
    const input = document.getElementById('search-input');
    input.value = '';
    resultsContainer.innerHTML = '';
    resultsContainer.classList.remove('visible');
}

function handleInput(e) {
    const query = e.target.value;
    const results = search(query);
    renderResults(results);
}

function handleClickOutside(e) {
    const input = document.getElementById('search-input');
    if (!resultsContainer.contains(e.target) && e.target !== input) {
        resultsContainer.classList.remove('visible');
    }
}

function handleFocus(e) {
    if (e.target.value.trim() !== '') {
        const results = search(e.target.value);
        renderResults(results);
    }
}

export function initSearch(collection, mapInstance) {
    markerCollection = collection;
    map = mapInstance;
    resultsContainer = createResultsContainer();

    const input = document.getElementById('search-input');
    input.addEventListener('input', handleInput);
    input.addEventListener('focus', handleFocus);
    document.addEventListener('click', handleClickOutside);
}