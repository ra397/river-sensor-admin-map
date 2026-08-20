import {
    getTickets,
    createTicket,
    editTicket,
    getMaintenanceCrew
} from "./api.js";
import {
    getFormData,
    getDiff,
    enterConfirm,
    exitConfirm,
    requireAuth,
    setFormValues,
    resetFormToDefaults,
    setupFormListeners
} from "./ticketForm.js";

const TICKET_COLUMNS = [
    { key: 'status', label: 'Status' },
    { key: 'problem', label: 'Problem' },
    { key: 'assignee', label: 'Assignee' },
    { key: 'created_at', label: 'Created', render: (value) => {
        if (!value) return '';
        const dt = new Date(value);
        return dt.toLocaleDateString();
    }},
];

let activeCleanup = null;

export async function renderManageTickets(container, observatory, authRequired = true) {
    if (!await requireAuth(authRequired)) return;

    // Re-opening the panel rebinds the form, drop the previous bindings first
    activeCleanup?.();
    activeCleanup = null;

    await populateCrewOptions(container);
    exitConfirm(container);
    container.classList.remove('hidden');

    const listEl = container.querySelector('.manage-list');
    const messageEl = container.querySelector('.manage-message');
    const formTitleEl = container.querySelector('.manage-form-title');

    const defaults = {
        observatory: observatory.name,
        problem: '',
        assignee: null,
        status: null,
        notes: ''
    };

    let tickets = [];         // the active tickets for this bridge
    let editing = null;       // the ticket being edited, null while creating
    let baseline = null;      // form values the current mode started from
    let pendingAction = null; // { type: 'save' }
    let cleanup;

    function setMessage(text, type = 'error') {
        messageEl.textContent = text ?? '';
        messageEl.classList.toggle('hidden', !text);
        messageEl.classList.toggle('error', !!text && type === 'error');
        messageEl.classList.toggle('confirm', !!text && type === 'confirm');
    }

    function renderList() {
        listEl.replaceChildren();

        if (tickets.length === 0) {
            const empty = document.createElement('div');
            empty.classList.add('manage-empty');
            empty.textContent = 'No active tickets for this bridge.';
            listEl.appendChild(empty);
            return;
        }

        const table = document.createElement('table');
        table.classList.add('manage-table');

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        TICKET_COLUMNS.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col.label;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        tickets.forEach(ticket => {
            const row = document.createElement('tr');
            row.classList.toggle('selected', ticket.ticket_id === editing?.ticket_id);

            TICKET_COLUMNS.forEach(col => {
                const td = document.createElement('td');
                const value = ticket[col.key];
                td.textContent = col.render ? col.render(value) : (value ?? '');
                row.appendChild(td);
            });

            row.addEventListener('click', () => {
                if (container.classList.contains('confirming')) return;
                if (ticket.ticket_id === editing?.ticket_id) {
                    startCreate();
                } else {
                    startEdit(ticket);
                }
            });

            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        listEl.appendChild(table);
    }

    function renderFormTitle() {
        formTitleEl.replaceChildren();

        const titleText = document.createElement('span');
        titleText.textContent = editing ? 'Editing Ticket' : 'New Ticket';
        formTitleEl.appendChild(titleText);

        if (editing) {
            const newLink = document.createElement('span');
            newLink.classList.add('manage-new-link');
            newLink.textContent = '+ New';
            newLink.addEventListener('click', () => {
                if (container.classList.contains('confirming')) return;
                startCreate();
            });
            formTitleEl.appendChild(newLink);
        }
    }

    function startCreate() {
        editing = null;
        resetFormToDefaults(container, defaults);
        baseline = getFormData(container);
        renderFormTitle();
        renderList();
        checkForChanges();
    }

    function startEdit(ticket) {
        editing = ticket;
        setFormValues(container, {
            observatory: observatory.name,
            problem: ticket.problem,
            assignee: ticket.assignee,
            status: ticket.status,
            notes: ticket.notes
        });
        baseline = getFormData(container);
        renderFormTitle();
        renderList();
        checkForChanges();
    }

    async function refreshList() {
        tickets = await getTickets(observatory.name);
        // The ticket being edited may have been closed elsewhere
        if (editing) {
            editing = tickets.find(t => t.ticket_id === editing.ticket_id) ?? null;
        }
        renderFormTitle();
        renderList();
    }

    function validate(data) {
        if (!data.observatory) return 'This ticket has no bridge.';
        if (!data.problem) return 'Describe the problem.';
        return null;
    }

    function checkForChanges() {
        const diff = getDiff(baseline, getFormData(container));
        submitBtn.disabled = Object.keys(diff).length === 0;
        if (!container.classList.contains('confirming')) {
            setMessage('');
        }
    }

    function handleReset() {
        if (editing) startEdit(editing);
        else startCreate();
    }

    function handleSubmit() {
        const data = getFormData(container);
        const error = validate(data);
        if (error) {
            setMessage(error);
            return;
        }

        pendingAction = { type: 'save' };
        setMessage(
            editing
                ? 'Save these changes to the ticket?'
                : `Open a new ticket for ${observatory.name}?`,
            'confirm'
        );
        enterConfirm(container, editing ? baseline : null);
    }

    async function handleApprove() {
        if (!pendingAction) return;

        try {
            const editedId = editing?.ticket_id ?? null;

            if (editing) {
                const changes = getDiff(baseline, getFormData(container));
                await editTicket(editedId, changes);
            } else {
                await createTicket(getFormData(container));
            }

            exitConfirm(container);
            pendingAction = null;

            editing = null;
            await refreshList();
            const saved = editedId ? tickets.find(t => t.ticket_id === editedId) ?? null : null;
            if (saved) startEdit(saved);
            else startCreate();

            setMessage(editedId ? 'Ticket saved.' : 'Ticket created.', 'info');
            window.dispatchEvent(new CustomEvent('update:observatories'));
        } catch (err) {
            handleError(err);
        }
    }

    function handleError(err) {
        exitConfirm(container);
        pendingAction = null;
        console.error(err);
        setMessage('Could not reach the server. Please try again.');
    }

    function handleCancel() {
        exitConfirm(container);
        pendingAction = null;
        setMessage('');
    }

    function handleClose() {
        exitConfirm(container);
        cleanup();
        activeCleanup = null;
        container.classList.add('hidden');
    }

    const { submitBtn, cleanup: cleanupFn } = setupFormListeners(container, {
        onClose: handleClose,
        onSubmit: handleSubmit,
        onReset: handleReset,
        onApprove: handleApprove,
        onCancel: handleCancel,
        onInputChange: checkForChanges
    });

    cleanup = cleanupFn;
    activeCleanup = cleanupFn;

    startCreate();
    setMessage('');

    try {
        await refreshList();
    } catch (err) {
        handleError(err);
    }
}

async function populateCrewOptions(container) {
    const crewSelect = container.querySelector('select[name="assignee"]');
    if (crewSelect.options.length > 0) return;

    const crew = await getMaintenanceCrew();
    crew.forEach(item => {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item;
        crewSelect.appendChild(option);
    });
}
