import { renderTickets } from "./renderTickets.js";
import {isAuthenticated} from "./auth.js";
import {showForm} from "./authUI.js";
import {renderCreateTicket} from "./renderCreateTicket.js";

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

export async function renderObservatoryInfoWindow(container, observatory, authRequired = false) {
    if (authRequired) {
        if (!isAuthenticated()) {
            // Launch authentication
            showForm(document.getElementById('login-container'));
            await new Promise(resolve => {
                window.addEventListener('auth:login', resolve, {once: true});
            });
        }
    }

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


    const btnContainer = document.createElement('div');
    btnContainer.classList.add('observatory-row-container');

    if (observatory.tickets.length > 0) {
        const viewTicketBtn = document.createElement('button');
        viewTicketBtn.textContent = "View Tickets";
        viewTicketBtn.classList.add('secondary');

        viewTicketBtn.addEventListener('click', () => {
            renderTickets(document.getElementById("viewTickets"), observatory);
        })

        btnContainer.appendChild(viewTicketBtn);
    }

    const createTicketBtn = document.createElement('button');
    createTicketBtn.textContent = "Create Ticket";
    createTicketBtn.classList.add('primary');

    createTicketBtn.addEventListener('click', () => {
        renderCreateTicket(document.getElementById("createTicket"), observatory);
    })

    btnContainer.appendChild(createTicketBtn);

    container.appendChild(btnContainer);

    const closeContainerEl = container.querySelector('.close-button');
    closeContainerEl.addEventListener('click', () => {
        container.classList.add('hidden');
    })
}