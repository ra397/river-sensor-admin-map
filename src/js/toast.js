const DEFAULT_DURATION = 5000;

// Toasts stack in a fixed container pinned to the top center of the screen
function getContainer() {
    return document.getElementById('toast-container');
}

export function showToast(text, duration = DEFAULT_DURATION) {
    const container = getContainer();
    if (!container || !text) return null;

    const toast = document.createElement('div');
    toast.classList.add('toast');
    toast.textContent = text;
    container.appendChild(toast);

    // Let the browser paint the starting state before the fade-in
    requestAnimationFrame(() => toast.classList.add('visible'));

    const remove = () => {
        clearTimeout(timer);
        toast.classList.remove('visible');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    };

    const timer = setTimeout(remove, duration);
    toast.addEventListener('click', remove);

    return remove;
}
