import {isAuthenticated} from "./auth.js";
import {promptLogin} from "./authUI.js";
import {renderManageTickets} from "./renderManageTickets.js";
import {renderNotifications} from "./renderNotifications.js";

const FIELD_LABELS = [
    { key: 'name', label: 'Name' },
    { key: 'sid', label: 'SID' },
    { key: 'status', label: 'Status' },
    { key: 'gps', label: 'GPS' },
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
    { key: 'latest_observation', label: 'Last Packet' },
    { key: 'no_packet_days', label: 'Days Offline' },
    { key: 'cooperator', label: 'Cooperator' },
    // { key: 'public_note', label: 'Public Note' },
];

export async function renderObservatoryInfoWindow(container, observatory, authRequired = false) {
    console.log("Rendering observatory info window: ", observatory);

    if (authRequired && !isAuthenticated()) {
        // Launch authentication, and give up if the user dismisses it
        if (!await promptLogin()) return;
    }

    container.querySelectorAll('.observatory-row-container').forEach(el => el.remove());
    container.classList.remove('hidden');


    FIELD_LABELS.forEach(field => {
        const value = field.key === 'gps'
            ? (observatory.latitude != null && observatory.longitude != null
                ? `${observatory.latitude}, ${observatory.longitude}`
                : null)
            : observatory[field.key];

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


    const btnContainer = document.createElement('div');
    btnContainer.classList.add('observatory-row-container');

    const manageNotificationsBtn = document.createElement('button');
    manageNotificationsBtn.textContent = "Notifications";
    manageNotificationsBtn.classList.add('secondary');

    manageNotificationsBtn.addEventListener('click', () => {
        renderNotifications(document.getElementById("manageNotifications"), observatory);
    })

    btnContainer.appendChild(manageNotificationsBtn);

    const manageTicketsBtn = document.createElement('button');
    manageTicketsBtn.textContent = "Tickets";
    manageTicketsBtn.classList.add('primary');

    manageTicketsBtn.addEventListener('click', () => {
        renderManageTickets(document.getElementById("manageTickets"), observatory);
    })

    btnContainer.appendChild(manageTicketsBtn);

    container.appendChild(btnContainer);

    const closeContainerEl = container.querySelector('.close-button');
    closeContainerEl.addEventListener('click', () => {
        container.classList.add('hidden');
    })
}