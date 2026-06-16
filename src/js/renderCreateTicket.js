import {createTicket} from "./api.js";
import {
    getFormData,
    enterConfirm,
    exitConfirm,
    requireAuth,
    setFormValues,
    resetFormToDefaults,
    setupFormListeners
} from "./ticketForm.js";

function isFormValid(data) {
    return data.observatory && data.problem;
}

export async function renderCreateTicket(container, observatory, authRequired = true) {
    await requireAuth(authRequired);

    container.classList.remove('hidden');

    const defaults = {
        observatory: observatory.name,
        problem: '',
        assignee: null,
        status: null,
        notes: ''
    };

    resetFormToDefaults(container, defaults);

    let cleanup;

    function checkForChanges() {
        const data = getFormData(container);
        submitBtn.disabled = !isFormValid(data);
    }

    function handleReset() {
        resetFormToDefaults(container, defaults);
        submitBtn.disabled = true;
    }

    async function handleApprove() {
        const data = getFormData(container);
        await createTicket(data);
        exitConfirm(container);
        cleanup();
        container.classList.add('hidden');
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
        enterConfirm(container, null);
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
    submitBtn.disabled = true;
}
