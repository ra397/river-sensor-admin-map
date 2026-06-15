import {isAuthenticated} from "./auth.js";
import {showForm} from "./authUI.js";
import {editTicket} from "./api.js";

let initialData = null;

function getFormData(container) {
    const data = {};
    container.querySelectorAll('.modal-input').forEach(input => {
        const name = input.name;
        if (input.tagName === 'TEXTAREA') {
            data[name] = input.value.trim() || null;
        } else if (input.tagName === 'SELECT') {
            data[name] = input.value;
        } else {
            data[name] = input.value.trim() || null;
        }
    });
    return data;
}

function getDiff(initial, current) {
    const diff = {};
    for (const key of Object.keys(current)) {
        if (current[key] !== initial[key]) {
            diff[key] = current[key];
        }
    }
    return diff;
}

function exitConfirm(container) {
    container.classList.remove('confirming');
    container.querySelectorAll('.modal-input').forEach(input => input.disabled = false);
    container.querySelectorAll('.original-value').forEach(el => el.remove());
}

function enterConfirm(container) {
    container.classList.add('confirming');
    container.querySelectorAll('.modal-input').forEach(input => input.disabled = true);

    const diff = getDiff(initialData, getFormData(container));
    for (const key of Object.keys(diff)) {
        const input = container.querySelector(`.modal-input[name="${key}"]`);
        if (!input) continue;
        const orig = document.createElement('div');
        orig.className = 'original-value';
        orig.textContent = initialData[key] || '(empty)';
        input.parentNode.insertBefore(orig, input);
    }
}

export async function renderEditTicket(container, ticket, observatoryName, authRequired = true) {
    if (authRequired) {
        if (!isAuthenticated()) {
            // Launch authentication
            showForm(document.getElementById('login-container'));
            await new Promise(resolve => {
                window.addEventListener('auth:login', resolve, {once: true});
            });
        }
    }

    console.log(ticket['ticket_id']);
    console.log(ticket);

    container.classList.remove('hidden');

    container.querySelector('[name="observatory"]').value = observatoryName || '';
    container.querySelector('[name="problem"]').value = ticket.problem || '';
    container.querySelector('[name="assignee"]').value = ticket.assignee || '';
    container.querySelector('[name="status"]').value = ticket.status || '';
    container.querySelector('[name="notes"]').value = ticket.notes || '';

    initialData = getFormData(container);

    const submitBtn = container.querySelector('.submit-btn');
    submitBtn.disabled = true;

    function checkForChanges() {
        const diff = getDiff(initialData, getFormData(container));
        submitBtn.disabled = Object.keys(diff).length === 0;
    }

    function handleReset() {
        container.querySelector('[name="observatory"]').value = initialData.observatory || '';
        container.querySelector('[name="problem"]').value = initialData.problem || '';
        container.querySelector('[name="assignee"]').value = initialData.assignee || '';
        container.querySelector('[name="status"]').value = initialData.status || '';
        container.querySelector('[name="notes"]').value = initialData.notes || '';
        submitBtn.disabled = true;
    }

    async function handleApprove() {
        const dataToSubmit = getDiff(initialData, getFormData(container));
        await editTicket(ticket['ticket_id'], dataToSubmit);
        exitConfirm(container);

        // Update form with the submitted changes so subsequent edits use fresh data
        Object.assign(ticket, dataToSubmit);
        initialData = getFormData(container);
        submitBtn.disabled = true;

        // Update observatories
        window.dispatchEvent(new CustomEvent('update:observatories'));
    }

    function handleCancel() {
        exitConfirm(container);
    }

    function handleClose() {
        cleanup();
        container.classList.add('hidden');
    }

    function handleSubmit() {
        enterConfirm(container);
    }

    function cleanup() {
        container.querySelector('.close-button').removeEventListener('click', handleClose);
        submitBtn.removeEventListener('click', handleSubmit);
        resetBtn.removeEventListener('click', handleReset);
        approveBtn.removeEventListener('click', handleApprove);
        cancelBtn.removeEventListener('click', handleCancel);
        container.querySelectorAll('.modal-input').forEach(input => {
            input.removeEventListener('input', checkForChanges);
        });
    }

    const resetBtn = container.querySelector('.reset-btn');
    const approveBtn = container.querySelector('.approve-btn');
    const cancelBtn = container.querySelector('.cancel-btn');

    container.querySelector('.close-button').addEventListener('click', handleClose);
    container.querySelectorAll('.modal-input').forEach(input => {
        input.addEventListener('input', checkForChanges);
    });
    submitBtn.addEventListener('click', handleSubmit);
    resetBtn.addEventListener('click', handleReset);
    approveBtn.addEventListener('click', handleApprove);
    cancelBtn.addEventListener('click', handleCancel);
}