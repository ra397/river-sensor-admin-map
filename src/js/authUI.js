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

function hideForgotPassword() {
    forgotPasswordForm.classList.add('hidden');
}

function hideNewPassword() {
    newPasswordForm.classList.add('hidden');
}

// Cancelling means dismissing the auth flow entirely, from any of its three forms
function cancelAuth() {
    window.dispatchEvent(new CustomEvent('auth:cancel'));
}

let pendingLogin = null;

// Show the login form and settle once the user is done with it: true when they
// logged in, false when they closed the form. Concurrent callers (e.g. several
// requests failing with 401 at once) share a single prompt.
export function promptLogin() {
    if (pendingLogin) return pendingLogin;

    showForm(loginForm);

    pendingLogin = new Promise(resolve => {
        const settle = (result) => {
            window.removeEventListener('auth:login', onLogin);
            window.removeEventListener('auth:cancel', onCancel);
            pendingLogin = null;
            resolve(result);
        };
        const onLogin = () => settle(true);
        const onCancel = () => settle(false);
        window.addEventListener('auth:login', onLogin);
        window.addEventListener('auth:cancel', onCancel);
    });

    return pendingLogin;
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

loginForm.querySelector('.close-button').addEventListener('click', () => {
    hideLogin();
    cancelAuth();
});
forgotPasswordForm.querySelector('.close-button').addEventListener('click', () => {
    hideForgotPassword();
    cancelAuth();
});
newPasswordForm.querySelector('.close-button').addEventListener('click', () => {
    hideNewPassword();
    cancelAuth();
});