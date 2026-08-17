import {isAuthenticated} from "./auth.js";
import {promptLogin} from "./authUI.js";

export function getFormData(container) {
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

export function getDiff(initial, current) {
    const diff = {};
    for (const key of Object.keys(current)) {
        if (current[key] !== initial[key]) {
            diff[key] = current[key];
        }
    }
    return diff;
}

export function exitConfirm(container) {
    container.classList.remove('confirming');
    container.querySelectorAll('.modal-input').forEach(input => input.disabled = false);
    container.querySelectorAll('.original-value').forEach(el => el.remove());
}

export function enterConfirm(container, initialData) {
    container.classList.add('confirming');
    container.querySelectorAll('.modal-input').forEach(input => input.disabled = true);

    if (initialData) {
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
}

export async function requireAuth(authRequired) {
    if (authRequired && !isAuthenticated()) {
        return promptLogin();
    }
    return true;
}

export function setFormValues(container, values) {
    for (const [name, value] of Object.entries(values)) {
        const input = container.querySelector(`[name="${name}"]`);
        if (!input) continue;
        if (input.tagName === 'SELECT') {
            input.value = value || '';
        } else {
            input.value = value || '';
        }
    }
}

export function resetFormToDefaults(container, defaults) {
    for (const [name, value] of Object.entries(defaults)) {
        const input = container.querySelector(`[name="${name}"]`);
        if (!input) continue;
        if (input.tagName === 'SELECT') {
            if (value === null) {
                input.selectedIndex = 0;
            } else {
                input.value = value;
            }
        } else {
            input.value = value || '';
        }
    }
}

export function setupFormListeners(container, handlers) {
    const { onClose, onSubmit, onReset, onApprove, onCancel, onInputChange } = handlers;

    const submitBtn = container.querySelector('.submit-btn');
    const resetBtn = container.querySelector('.reset-btn');
    const approveBtn = container.querySelector('.approve-btn');
    const cancelBtn = container.querySelector('.cancel-btn');
    const closeBtn = container.querySelector('.close-button');

    function cleanup() {
        closeBtn.removeEventListener('click', onClose);
        submitBtn.removeEventListener('click', onSubmit);
        resetBtn.removeEventListener('click', onReset);
        approveBtn.removeEventListener('click', onApprove);
        cancelBtn.removeEventListener('click', onCancel);
        container.querySelectorAll('.modal-input').forEach(input => {
            input.removeEventListener('input', onInputChange);
        });
    }

    closeBtn.addEventListener('click', onClose);
    submitBtn.addEventListener('click', onSubmit);
    resetBtn.addEventListener('click', onReset);
    approveBtn.addEventListener('click', onApprove);
    cancelBtn.addEventListener('click', onCancel);
    container.querySelectorAll('.modal-input').forEach(input => {
        input.addEventListener('input', onInputChange);
    });

    return { submitBtn, resetBtn, approveBtn, cancelBtn, cleanup };
}
