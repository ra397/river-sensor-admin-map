import {editTicket} from "./api.js";
import {
    getFormData,
    getDiff,
    enterConfirm,
    exitConfirm,
    requireAuth,
    setFormValues,
    setupFormListeners
} from "./ticketForm.js";

export async function renderEditTicket(container, ticket, observatoryName, authRequired = true) {
    await requireAuth(authRequired);

    container.classList.remove('hidden');

    // Dynamically populate maintenance crew from API
    const crew = await getMaintenanceCrew();
    const crewSelect = container.querySelector('select[name="assignee"]');
    crew.forEach(item => {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item;
        crewSelect.appendChild(option);
    });


    setFormValues(container, {
        observatory: observatoryName,
        problem: ticket.problem,
        assignee: ticket.assignee,
        status: ticket.status,
        notes: ticket.notes
    });

    let initialData = getFormData(container);
    let cleanup;

    function checkForChanges() {
        const diff = getDiff(initialData, getFormData(container));
        submitBtn.disabled = Object.keys(diff).length === 0;
    }

    function handleReset() {
        setFormValues(container, initialData);
        submitBtn.disabled = true;
    }

    async function handleApprove() {
        const dataToSubmit = getDiff(initialData, getFormData(container));
        await editTicket(ticket['ticket_id'], dataToSubmit);
        exitConfirm(container);

        Object.assign(ticket, dataToSubmit);
        initialData = getFormData(container);
        submitBtn.disabled = true;

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
        enterConfirm(container, initialData);
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
