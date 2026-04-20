const TOKEN_KEY = 'access_token';

export function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
    sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated() {
    return !!getToken();
}

export async function login(email, password) {
    clearToken();
    const response = await fetch('/hydroiowa/api/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
        throw new Error('Login failed');
    }

    const data = await response.json();
    setToken(data.access_token);
}

export async function logout() {
    clearToken();
}

export async function requestOneTimeCode(email) {
    const response = await fetch('/hydroiowa/api/forgot-password', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
    });

    if (!response.ok) {
        throw new Error('Failed to request one-time code');
    }

    const data = await response.json();
    return data.message;
}

export async function submitNewPassword(email, code, password) {
    const response = await fetch('/hydroiowa/api/reset-password', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, code, password }),
    });

    if (!response.ok) {
        throw new Error('Failed to reset password');
    }

    const data = await response.json();
    return data.message;
}