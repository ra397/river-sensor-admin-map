let markers = null;
let observatoryData = null;

let filterState = {};
let filterMemory = {};

const SHOW_ALL = 'Show All';

const filters = {
    status:           { label: 'Status',         type: 'includes', options: ['Show All', 'active', 'defective', 'suspended', 'retired'] },
    sampling_rate:    { label: 'Rate',           type: 'includes', options: ['Show All', '2', '3', '4', '5'] },
    // firmware_version: { label: 'Firmware',       type: 'includes', options: ['Show All', '0.6', '0.86', '0.88', '0.89', '0.90', '1.00', '1.01', '6.1'] },
    no_packet_days:   { label: 'No Packet Days', type: 'range',    options: ['Show All', '< 7', '7 - 14', '> 14'] },
    voltage:      { label: 'Voltage',        type: 'range',            options: ['Show All', '< 11.76', '11.76 - 12.07', '12.07 - 12.41', '12.41 - 12.64', '> 12.64'] },
    tools:            { label: 'Tools',          type: 'includes', options: ['Show All', 'Ticket', 'Public Note'] },
};

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
            checkbox.checked = (option === SHOW_ALL);
            checkbox.dataset.filterCategory = key;

            checkbox.addEventListener('change', (e) => {
                toggleFilterOption(e.target.dataset.filterCategory, e.target.value, e.target.checked);
                applyFilters();
            });

            label.append(checkbox, ' ', option);
            label.className = 'filter-option';
            optionsEl.append(label);
        }

        groupEl.appendChild(optionsEl);
        container.appendChild(groupEl);
    }

    syncAllCheckboxDisabledStates();
}

function resetFilterState(filters) {
    for (const key of Object.keys(filterState)) delete filterState[key];
    for (const key of Object.keys(filterMemory)) delete filterMemory[key];

    for (const [key] of Object.entries(filters)) {
        filterState[key] = [SHOW_ALL];
    }
}

function toggleFilterOption(category, value, checked) {
    if (checked) {
        if (value === SHOW_ALL) {
            // Stash everything else, then collapse to Show All
            filterMemory[category] = filterState[category].filter(v => v !== SHOW_ALL);
            filterState[category] = [SHOW_ALL];
        } else {
            filterState[category] = filterState[category].filter(v => v !== SHOW_ALL);
            filterState[category].push(value);
        }
    } else {
        if (value === SHOW_ALL) {
            // Restore the stashed selection
            const remembered = filterMemory[category] || [];
            filterState[category] = [...remembered];
        } else {
            filterState[category] = filterState[category].filter(v => v !== value);
        }
    }
    syncCheckboxDisabledState(category);
}

function syncCheckboxDisabledState(category) {
    const showAllChecked = filterState[category].includes(SHOW_ALL);
    const checkboxes = document.querySelectorAll(
        `input[type="checkbox"][data-filter-category="${category}"]`
    );
    checkboxes.forEach(cb => {
        if (cb.value === SHOW_ALL) return;
        cb.disabled = showAllChecked;
        cb.checked = !showAllChecked && filterState[category].includes(cb.value);
        const label = cb.closest('label');
        if (label) label.classList.toggle('filter-option-disabled', showAllChecked);
    });
}

function syncAllCheckboxDisabledStates() {
    for (const category of Object.keys(filters)) {
        syncCheckboxDisabledState(category);
    }
}

function applyFilters() {
    const passes = buildFilterFunc();

    for (const obs of observatoryData) {
        const marker = markers.get(obs.oid);
        if (!marker) continue;
        marker.setVisible(passes(obs));
    }
}

function buildFilterFunc() {
    return function (data) {
        for (const [key, filter] of Object.entries(filters)) {
            const selected = filterState[key];

            // Show All: skip this category
            if (selected && selected.includes(SHOW_ALL)) continue;

            // Nothing selected: hide
            if (!selected || selected.length === 0) return false;

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
    if (rangeStr.startsWith('< ')) return { type: 'lt', val: parseFloat(rangeStr.slice(2)) };
    if (rangeStr.startsWith('> ')) return { type: 'gt', val: parseFloat(rangeStr.slice(2)) };
    const parts = rangeStr.split(' - ');
    if (parts.length === 2) return { type: 'between', lo: parseFloat(parts[0]), hi: parseFloat(parts[1]) };
    return null;
}

function matchesRange(value, rangeStr) {
    const r = parseRange(rangeStr);
    if (!r) return false;
    if (r.type === 'lt') return value < r.val;
    if (r.type === 'gt') return value >= r.val;
    if (r.type === 'between') return value >= r.lo && value <= r.hi;
    return false;
}

function matchesToolFilter(data, selectedTools) {
    for (const tool of selectedTools) {
        if (tool === 'Ticket' && data.tickets && data.tickets.length > 0) return true;
        if (tool === 'Public Note' && data.public_note != null) return true;
    }
    return false;
}

export function initFilters(markersInstance, data) {
    markers = markersInstance;
    observatoryData = data;
    resetFilterState(filters);
    renderFilters(filters);
}