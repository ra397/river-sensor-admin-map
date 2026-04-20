let markerCollection = null;

let filterState = {};
let filterCounts = {};

const filters = {
    status:       { label: 'Status',         type: 'includes',         options: ['active', 'decommissioned', 'maintenance', 'retired'] },
    sampling_rate:         { label: 'Rate',           type: 'includes',         options: ['2', '3', '4', '5'] },
    firmware_version:     { label: 'Firmware',       type: 'includes',         options: ['0.6', '0.86', '0.88', '0.89', '0.90', '1.00', '1.01', '6.1'] },
    no_packet_days: { label: 'No Packet Days', type: 'range',            options: ['< 7', '7 - 14', '> 14'] },
    voltage:      { label: 'Voltage',        type: 'range',            options: ['< 10', '10 - 11', '11 - 12', '12 - 13', '> 13'] },
    tools:        { label: 'Tools',          type: 'includes',         options: ['Ticket', 'Public Note'] },
}

function renderFilters(filters) {
    const container = document.querySelector('#filter-groups');
    if (!container) return;
    container.innerHTML = '';

    for (const [key, filter] of Object.entries(filters)) {
        const groupEl = document.createElement('div');
        groupEl.className = 'filter-group';

        const titleEl = document.createElement('div');
        titleEl.className = 'filter-title';
        titleEl.innerHTML = `<svg class="chevron" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"></path></svg><span>${filter.label}</span>`;
        titleEl.addEventListener('click', () => groupEl.classList.toggle('open'));
        groupEl.appendChild(titleEl);

        const optionsEl = document.createElement('div');
        optionsEl.className = 'filter-options';

        for (const option of filter.options) {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = option;
            checkbox.checked = true;
            checkbox.dataset.category = key;

            checkbox.addEventListener('change', (e) => {
                toggleFilterOption(e.target.dataset.category, e.target.value, e.target.checked);
                applyFilters();
            });

            label.append(checkbox, ' ', option);
            label.className = 'filter-option';
            optionsEl.append(label);
        }

        groupEl.appendChild(optionsEl);
        container.appendChild(groupEl);
    }
}

function resetFilterState(filters) {
    for (const key of Object.keys(filterState)) delete filterState[key];
    for (const key of Object.keys(filterCounts)) delete filterCounts[key];

    for (const [key, filter] of Object.entries(filters)) {
        filterState[key] = [...filter.options];
        filterCounts[key] = filter.options.length;
    }
}

function toggleFilterOption(category, value, checked) {
    if (checked) {
        if (!filterState[category].includes(value)) {
            filterState[category].push(value);
        }
    } else {
        filterState[category] = filterState[category].filter(v => v !== value);
    }
}

function applyFilters() {
    markerCollection.setFilter(buildFilterFunc());
}

function buildFilterFunc() {
    return function (data) {
        // Checkbox filters
        for (const [key, filter] of Object.entries(filters)) {
            const selected = filterState[key];
            if (!selected || selected.length >= filterCounts[key])
                continue;

            // Special handling for tools filter
            if (key === 'tools') {
                if (!matchesToolFilter(data, selected)) return false;
                continue;
            }

            const value = data[key];
            if (filter.type === 'range') {
                if (value == null || value === '') return false;
                if (!selected.some(r => matchesRange(value, r))) return false;
            } else {
                if (!selected.includes(String(value ?? ''))) return false;
            }
        }

        return true;
    };
}

function parseRange(rangeStr) {
    if (rangeStr.startsWith('< '))  return { type: 'lt', val:
            parseFloat(rangeStr.slice(2)) };
    if (rangeStr.startsWith('> '))  return { type: 'gt', val:
            parseFloat(rangeStr.slice(2)) };
    const parts = rangeStr.split(' - ');
    if (parts.length === 2) return { type: 'between', lo:
            parseFloat(parts[0]), hi: parseFloat(parts[1]) };
    return null;
}

function matchesRange(value, rangeStr) {
    const r = parseRange(rangeStr);
    if (!r) return false;
    if (r.type === 'lt')      return value < r.val;
    if (r.type === 'gt')      return value >= r.val;
    if (r.type === 'between') return value >= r.lo && value <= r.hi;
    return false;
}

function matchesToolFilter(data, selectedTools) {
    // Check each tool option - marker passes if it matches ANY selected tool
    for (const tool of selectedTools) {
        if (tool === 'Ticket' && data.tickets && data.tickets.length > 0) {
            return true;
        }
        if (tool === 'Public Note' && data.public_note != null) {
            return true;
        }
    }
    // If no tools are selected, or none match, marker doesn't pass
    return false;
}

export function initFilters(collection) {
    markerCollection = collection;
    resetFilterState(filters);
    renderFilters(filters);
}