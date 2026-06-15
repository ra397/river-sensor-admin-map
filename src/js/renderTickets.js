import {isAuthenticated} from "./auth.js";
import {showForm} from "./authUI.js";
import {renderEditTicket} from "./renderEditTicket.js";

const TICKET_COLUMNS = [
    { key: 'status', label: 'Status' },
    { key: 'problem', label: 'Problem' },
    { key: 'assignee', label: 'Assignee' },
    { key: 'created_by', label: 'Created By' },
    { key: 'created_at', label: 'Created', render: (value) => {
        if (!value) return '';
        const dt = new Date(value);
        return dt.toLocaleDateString();
    }},
];

export async function renderTickets(container, observatory, authRequired = true) {
    if (authRequired) {
        if (!isAuthenticated()) {
            // Launch authentication
            showForm(document.getElementById('login-container'));
            await new Promise(resolve => {
                window.addEventListener('auth:login', resolve, {once: true});
            });
        }
    }

    if (!observatory.tickets) {
        container.classList.add('hidden');
        return;
    }

    container.querySelectorAll('.tickets-table, .tickets-empty').forEach(el => el.remove());
    container.classList.remove('hidden');

    const table = document.createElement('table');
    table.classList.add('tickets-table');

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    TICKET_COLUMNS.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col.label;
        headerRow.appendChild(th);
    });
    const actionsHeader = document.createElement('th');
    actionsHeader.textContent = '';
    headerRow.appendChild(actionsHeader);
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    observatory.tickets.forEach(ticket => {
        const row = document.createElement('tr');

        TICKET_COLUMNS.forEach(col => {
            const td = document.createElement('td');
            const value = ticket[col.key];
            td.textContent = col.render ? col.render(value) : (value ?? '');
            row.appendChild(td);
        });

        row.addEventListener('click', () => {
            renderEditTicket(document.getElementById('editTicket'), ticket, observatory['name']);
            container.classList.add('hidden');
        });

        tbody.appendChild(row);
    });
    table.appendChild(tbody);

    container.appendChild(table);

    const closeContainerEl = container.querySelector('.close-button');
    closeContainerEl.addEventListener('click', () => {
        container.classList.add('hidden');
    });
}