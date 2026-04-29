let markers = null;
let map = null;
let resultsContainer = null;
let observatoryData = null;

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

function scoreMatch(observatory, query) {
    const q = query.toLowerCase();

    for (let i = 0; i < SEARCH_PROPERTIES.length; i++) {
        const prop = SEARCH_PROPERTIES[i];
        const value = observatory[prop];
        if (value == null) continue;

        const str = String(value).toLowerCase();
        if (str.startsWith(q)) {
            return { score: i, matchType: 'starts', prop, value: String(value) };
        }
    }

    for (let i = 0; i < SEARCH_PROPERTIES.length; i++) {
        const prop = SEARCH_PROPERTIES[i];
        const value = observatory[prop];
        if (value == null) continue;

        const str = String(value).toLowerCase();
        if (str.includes(q)) {
            return { score: SEARCH_PROPERTIES.length + i, matchType: 'contains', prop, value: String(value) };
        }
    }

    return null;
}

function search(query) {
    if (!query || query.trim() === '') return [];

    const results = [];
    const trimmed = query.trim();

    for (const observatory of observatoryData) {
        const match = scoreMatch(observatory, trimmed);
        if (match) results.push({ observatory, ...match });
    }

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

        const name = result.observatory.name || 'Unknown';
        const matchInfo = result.prop !== 'name' ? ` (${result.value})` : '';
        item.textContent = name + matchInfo;

        item.addEventListener('click', () => {
            zoomToObservatory(result.observatory);
            clearSearch();
        });

        resultsContainer.appendChild(item);
    }

    resultsContainer.classList.add('visible');
}

function zoomToObservatory(observatory) {
    map.setCenter({ lat: observatory.latitude, lng: observatory.longitude });
    map.setZoom(14);

    const marker = markers.get(observatory.oid);
    if (marker) markers.select(marker);
}

function clearSearch() {
    const input = document.getElementById('search-input');
    input.value = '';
    resultsContainer.innerHTML = '';
    resultsContainer.classList.remove('visible');
}

function handleInput(e) {
    renderResults(search(e.target.value));
}

function handleClickOutside(e) {
    const input = document.getElementById('search-input');
    if (!resultsContainer.contains(e.target) && e.target !== input) {
        resultsContainer.classList.remove('visible');
    }
}

function handleFocus(e) {
    if (e.target.value.trim() !== '') {
        renderResults(search(e.target.value));
    }
}

export function initSearch(markersInstance, mapInstance, data) {
    markers = markersInstance;
    map = mapInstance;
    observatoryData = data;
    resultsContainer = createResultsContainer();

    const input = document.getElementById('search-input');
    input.addEventListener('input', handleInput);
    input.addEventListener('focus', handleFocus);
    document.addEventListener('click', handleClickOutside);
}