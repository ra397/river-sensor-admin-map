import {login, requestOneTimeCode, submitNewPassword} from "./auth.js";

const loginForm = document.getElementById('login-container');
const forgotPasswordForm = document.getElementById('forgot-password-container');
const newPasswordForm = document.getElementById('new-password-container');

const forms = [loginForm, forgotPasswordForm, newPasswordForm];
export function showForm(targetForm) {
    forms.forEach(form => {
        // Adds 'hidden' if it's not the target, removes it if it is
        form.classList.toggle('hidden', form !== targetForm);
    });
}

function hideLogin() {
    loginForm.classList.add('hidden');
}

// Login form handler
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        await login(email, password);
        sessionStorage.setItem('user-email', email);
        hideLogin();
        window.dispatchEvent(new CustomEvent('auth:login'));
    } catch {
        alert('Invalid email or password');
    }
});

// Forgot password handlers
document.getElementById('forgot-password-link').addEventListener('click', () => {
    showForm(forgotPasswordForm);
});

document.querySelectorAll('.back-to-login').forEach(el => {
    el.addEventListener('click', () => showForm(loginForm));
});

document.getElementById('get-otp-btn').addEventListener('click', async () => {
    const email = document.getElementById('forgot-email').value.toLowerCase().trim();
    try {
        await requestOneTimeCode(email);
        showForm(newPasswordForm);
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
        showForm(loginForm);
        alert("Successfully reset password");
    } catch {
        alert('Failed to reset password. Please try again.');
    }
});