import { login, requestOneTimeCode, submitNewPassword } from "./auth.js";

export function showView(viewId) {
    const views = ['login-view', 'forgot-password-view', 'new-password-view', 'main-view'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (id === viewId) {
            el.style.display = 'flex';
        } else {
            el.style.display = 'none';
        }
    });
}

// Login form handler
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        await login(email, password);
        showView('main-view');
        window.dispatchEvent(new CustomEvent('auth:login'));

        sessionStorage.setItem('user-email', email);
    } catch {
        alert('Invalid email or password');
    }
});

// Forgot password handlers
document.getElementById('forgot-password-link').addEventListener('click', () => {
    showView('forgot-password-view');
});

document.querySelectorAll('.back-to-login').forEach(el => {
    el.addEventListener('click', () => showView('login-view'));
});

document.getElementById('get-otp-btn').addEventListener('click', async () => {
    const email = document.getElementById('forgot-email').value.toLowerCase().trim();
    try {
        await requestOneTimeCode(email);
        document.getElementById('reset-email').value = email;
        showView('new-password-view');
    } catch {
        alert('Failed to send one-time code. Please try again.');
    }
});

document.getElementById('reset-password-btn').addEventListener('click', async () => {
    const email = document.getElementById('reset-email').value.toLowerCase().trim();
    const oneTimeCode = document.getElementById('reset-otp').value;
    const password = document.getElementById('reset-password').value;
    const passwordConfirm = document.getElementById('reset-password-confirm').value;

    if (password !== passwordConfirm) {
        alert('Passwords do not match.');
        return;
    }

    try {
        await submitNewPassword(email, oneTimeCode, password);
        showView('login-view');
        alert("Successfully reset password");
    } catch {
        alert('Failed to reset password. Please try again.');
    }
});