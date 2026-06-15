const FIELD_LABELS = [
    { key: 'name', label: 'Name' },
    { key: 'sid', label: 'SID' },
    { key: 'status', label: 'Status' },
    { key: 'latitude', label: 'Latitude' },
    { key: 'longitude', label: 'Longitude' },
    { key: 'elevation', label: 'Elevation' },
    { key: 'town', label: 'Town' },
    { key: 'road', label: 'Road' },
    { key: 'intersection', label: 'Intersection' },
    { key: 'river', label: 'River' },
    { key: 'imei', label: 'IMEI' },
    { key: 'firmware_version', label: 'Firmware' },
    { key: 'voltage', label: 'Voltage' },
    { key: 'orientation', label: 'Orientation' },
    { key: 'updown', label: 'Up/Down' },
    { key: 'latest_observation', label: 'Latest Observation' },
    { key: 'no_packet_days', label: 'Days Without Packet' },
    { key: 'cooperator', label: 'Cooperator' },
    { key: 'public_note', label: 'Public Note' },
];

export function renderObservatoryInfoWindow(container, observatory) {
    container.querySelectorAll('.observatory-row-container').forEach(el => el.remove());
    container.classList.remove('hidden');

    FIELD_LABELS.forEach(field => {
        const value = observatory[field.key];

        if (value != null) {
            const rowContainerEl = document.createElement('div');
            rowContainerEl.classList.add('observatory-row-container');

            const labelEl = document.createElement('span');
            labelEl.textContent = field.label + ':';
            labelEl.classList.add('observatory-label');

            const valueEl = document.createElement('span');
            if (field.key === 'latest_observation') {
                const dt = new Date(value);
                valueEl.textContent = dt.toLocaleString();
            } else {
                valueEl.textContent = String(value);
            }
            valueEl.classList.add('observatory-value');

            rowContainerEl.append(labelEl);
            rowContainerEl.append(valueEl);

            container.appendChild(rowContainerEl);
        }
    });

    const closeContainerEl = container.querySelector('.close-button');
    closeContainerEl.addEventListener('click', () => {
        container.classList.add('hidden');
    })
}

document.getElementById("renderObservatoryContainer").classList.add('hidden');