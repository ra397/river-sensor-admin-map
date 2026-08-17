import {
    ApiError,
    getNotifications,
    createNotification,
    editNotification,
    deleteNotification
} from "./api.js";
import {
    enterConfirm,
    exitConfirm,
    requireAuth,
    setFormValues,
    setupFormListeners
} from "./ticketForm.js";
import { showToast } from "./toast.js";

const MIN_BUFFER_HOURS = 3;
const MAX_BUFFER_HOURS = 24;
const DEFAULT_BUFFER_HOURS = 6;
const MAX_THRESHOLD = 999999.99;
const MIN_THRESHOLD_SPACING = 15.24; // cm - half a foot, per user per bridge

const NOTIFICATION_COLUMNS = [
    { key: 'threshold', label: 'Threshold (cm)', render: (value) => toCentimeters(value) },
    { key: 'buffer_hours', label: 'Every (hrs)' },
];

// The server stores numeric(8,2) and rounds half-up, so mirror that when
// comparing thresholds client-side.
function toCents(value) {
    return Math.sign(value) * Math.round(Math.abs(value) * 100);
}

function toCentimeters(value) {
    return Number(value).toFixed(2);
}

let activeCleanup = null;

export async function renderNotifications(container, observatory, authRequired = true) {
    await requireAuth(authRequired);

    // Re-opening the panel rebinds the form, drop the previous bindings first
    activeCleanup?.();
    activeCleanup = null;

    populateBufferOptions(container);
    exitConfirm(container);
    container.classList.remove('hidden');

    showToast('Tip: open the Measurements plot and click it to pick a threshold.');

    const listEl = container.querySelector('.manage-list');
    const messageEl = container.querySelector('.manage-message');
    const formTitleEl = container.querySelector('.manage-form-title');
    const thresholdEl = container.querySelector('[name="threshold"]');
    const bufferEl = container.querySelector('[name="buffer_hours"]');

    setFormValues(container, { observatory: observatory.name });

    let registrations = [];   // this user's registrations for this bridge only
    let editing = null;       // the registration being edited, null while creating
    let pendingAction = null; // { type: 'save' } | { type: 'delete', registration }
    let cleanup;

    function setMessage(text, type = 'error') {
        messageEl.textContent = text ?? '';
        messageEl.classList.toggle('hidden', !text);
        messageEl.classList.toggle('error', !!text && type === 'error');
        messageEl.classList.toggle('confirm', !!text && type === 'confirm');
    }

    function renderList() {
        listEl.replaceChildren();

        if (registrations.length === 0) {
            const empty = document.createElement('div');
            empty.classList.add('manage-empty');
            empty.textContent = 'No notifications registered for this bridge.';
            listEl.appendChild(empty);
            return;
        }

        const table = document.createElement('table');
        table.classList.add('manage-table');

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        NOTIFICATION_COLUMNS.forEach(col => {
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
        registrations.forEach(registration => {
            const row = document.createElement('tr');
            row.classList.toggle('selected', registration.notification_id === editing?.notification_id);

            NOTIFICATION_COLUMNS.forEach(col => {
                const td = document.createElement('td');
                const value = registration[col.key];
                td.textContent = col.render ? col.render(value) : (value ?? '');
                row.appendChild(td);
            });

            const actionsCell = document.createElement('td');
            actionsCell.classList.add('row-actions');

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.classList.add('delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (container.classList.contains('confirming')) return;
                startEdit(registration);
                pendingAction = { type: 'delete', registration };
                setMessage(
                    `Delete the ${toCentimeters(registration.threshold)} cm notification for ${observatory.name}? This cannot be undone.`,
                    'confirm'
                );
                enterConfirm(container, null);
            });

            actionsCell.appendChild(deleteBtn);
            row.appendChild(actionsCell);

            row.addEventListener('click', () => {
                if (container.classList.contains('confirming')) return;
                if (registration.notification_id === editing?.notification_id) {
                    startCreate();
                } else {
                    startEdit(registration);
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
        titleText.textContent = editing
            ? `Editing ${toCentimeters(editing.threshold)} cm`
            : 'New Notification';
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

    // Lets the measurements plot arm threshold picking and highlight the line
    // belonging to the registration being edited
    function announcePanel(open = true) {
        window.dispatchEvent(new CustomEvent('notifications:panel', {
            detail: { open, oid: observatory.oid, editingId: editing?.notification_id ?? null }
        }));
    }

    function startCreate() {
        editing = null;
        thresholdEl.value = '';
        bufferEl.value = String(DEFAULT_BUFFER_HOURS);
        renderFormTitle();
        renderList();
        checkForChanges();
        announcePanel();
    }

    function startEdit(registration) {
        editing = registration;
        thresholdEl.value = toCentimeters(registration.threshold);
        bufferEl.value = String(registration.buffer_hours);
        renderFormTitle();
        renderList();
        checkForChanges();
        announcePanel();
    }

    async function refreshList() {
        const all = await getNotifications();
        registrations = all.filter(r => r.oid === observatory.oid);
        // The record being edited may have been removed elsewhere
        if (editing) {
            editing = registrations.find(r => r.notification_id === editing.notification_id) ?? null;
        }
        renderFormTitle();
        renderList();
        announcePanel();
    }

    function getFormValues() {
        const raw = thresholdEl.value.trim();
        return {
            threshold: raw === '' ? null : Number(raw),
            buffer_hours: Number(bufferEl.value),
        };
    }

    // Mirrors the server rules for instant feedback, the server is still
    // authoritative and gets the final word on every write.
    function validate(data) {
        if (data.threshold === null || !Number.isFinite(data.threshold)) {
            return 'Enter a threshold in centimeters.';
        }
        if (Math.abs(data.threshold) > MAX_THRESHOLD) {
            return `Threshold must be between -${MAX_THRESHOLD} and ${MAX_THRESHOLD} cm.`;
        }
        if (!Number.isInteger(data.buffer_hours)
            || data.buffer_hours < MIN_BUFFER_HOURS
            || data.buffer_hours > MAX_BUFFER_HOURS) {
            return `Repeat window must be between ${MIN_BUFFER_HOURS} and ${MAX_BUFFER_HOURS} hours.`;
        }

        const cents = toCents(data.threshold);
        const conflict = registrations.find(r =>
            r.notification_id !== editing?.notification_id
            && Math.abs(toCents(Number(r.threshold)) - cents) < toCents(MIN_THRESHOLD_SPACING)
        );
        if (conflict) {
            return `Thresholds for a bridge must be at least ${MIN_THRESHOLD_SPACING} cm apart. `
                + `You already have one at ${toCentimeters(conflict.threshold)} cm.`;
        }

        return null;
    }

    function hasChanges(data) {
        if (!editing) return data.threshold !== null;
        return toCents(data.threshold ?? NaN) !== toCents(Number(editing.threshold))
            || data.buffer_hours !== editing.buffer_hours;
    }

    function checkForChanges() {
        const data = getFormValues();
        submitBtn.disabled = !hasChanges(data);
        if (!container.classList.contains('confirming')) {
            setMessage('');
        }
    }

    function handleReset() {
        if (editing) startEdit(editing);
        else startCreate();
    }

    function handleSubmit() {
        const data = getFormValues();
        const error = validate(data);
        if (error) {
            setMessage(error);
            return;
        }

        pendingAction = { type: 'save' };
        setMessage(
            editing
                ? `Update this notification to ${toCentimeters(data.threshold)} cm every ${data.buffer_hours} hours?`
                : `Notify me when ${observatory.name} crosses ${toCentimeters(data.threshold)} cm, at most once every ${data.buffer_hours} hours?`,
            'confirm'
        );
        enterConfirm(container, null);
    }

    async function handleApprove() {
        const action = pendingAction;
        if (!action) return;

        try {
            if (action.type === 'delete') {
                await deleteNotification(action.registration.notification_id);
                exitConfirm(container);
                pendingAction = null;
                editing = null;
                await refreshList();
                startCreate();
                setMessage('Notification deleted.', 'info');
                window.dispatchEvent(new CustomEvent('update:notifications'));
                return;
            }

            const data = getFormValues();
            let savedId;

            if (editing) {
                const changes = {};
                if (toCents(data.threshold) !== toCents(Number(editing.threshold))) {
                    changes.threshold = data.threshold;
                }
                if (data.buffer_hours !== editing.buffer_hours) {
                    changes.buffer_hours = data.buffer_hours;
                }
                const result = await editNotification(editing.notification_id, changes);
                savedId = result?.id ?? editing.notification_id;
            } else {
                const result = await createNotification({
                    oid: observatory.oid,
                    threshold: data.threshold,
                    buffer_hours: data.buffer_hours,
                });
                savedId = result?.id ?? null;
            }

            exitConfirm(container);
            pendingAction = null;

            // The server rounds to 2 decimal places, so show what it stored
            editing = null;
            await refreshList();
            const saved = registrations.find(r => r.notification_id === savedId) ?? null;
            if (saved) startEdit(saved);
            else startCreate();

            setMessage(
                saved
                    ? `Saved. You will be notified above ${toCentimeters(saved.threshold)} cm.`
                    : 'Saved.',
                'info'
            );
            window.dispatchEvent(new CustomEvent('update:notifications'));
        } catch (err) {
            await handleError(err);
        }
    }

    async function handleError(err) {
        exitConfirm(container);
        pendingAction = null;

        if (err instanceof ApiError) {
            // 113 does not distinguish "missing" from "not yours", treat it as gone
            if (err.code === 113) {
                editing = null;
                try {
                    await refreshList();
                } catch {
                    // the list stays as it was, the message below still applies
                }
                startCreate();
                setMessage(err.message || 'That notification no longer exists.');
                return;
            }
            // 110, 111 and 112 all carry user-safe messages, 111 and 112 mean
            // the same thing to the user - the threshold conflicts
            setMessage(err.message);
            return;
        }

        console.error(err);
        setMessage('Could not reach the server. Please try again.');
    }

    function handleCancel() {
        exitConfirm(container);
        pendingAction = null;
        setMessage('');
    }

    // Picking a threshold off the measurements plot fills the field, saving it
    // still goes through the usual confirm step
    function handlePlotClick(e) {
        const { observatoryId, y } = e.detail;
        if (observatoryId !== observatory.oid) return;
        if (container.classList.contains('confirming')) return;
        if (Math.abs(y) > MAX_THRESHOLD) return;

        thresholdEl.value = toCentimeters(y);
        checkForChanges();
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

    window.addEventListener('plot:click', handlePlotClick);

    cleanup = () => {
        cleanupFn();
        window.removeEventListener('plot:click', handlePlotClick);
        announcePanel(false);
    };
    activeCleanup = cleanup;

    startCreate();
    setMessage('');

    try {
        await refreshList();
    } catch (err) {
        await handleError(err);
    }
}

function populateBufferOptions(container) {
    const bufferSelect = container.querySelector('select[name="buffer_hours"]');
    if (bufferSelect.options.length > 0) return;

    for (let hours = MIN_BUFFER_HOURS; hours <= MAX_BUFFER_HOURS; hours = hours + 3) {
        const option = document.createElement('option');
        option.value = String(hours);
        option.textContent = `${hours} hours`;
        bufferSelect.appendChild(option);
    }
    bufferSelect.value = String(DEFAULT_BUFFER_HOURS);
}
