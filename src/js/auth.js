import { baseUrl, apiConfig } from "./importApiConfig.js";

const TOKEN_KEY = 'access_token';

// Sent in place of a JWT when the backend runs with JWT auth turned off
export const DEMO_USER_EMAIL = 'nddot@demo.net';

// Settled once at startup from the backend. Defaults to true so a failed check
// leaves the login flow in place rather than silently unlocking the app.
let jwtAuthEnabled = true;

export function setJwtAuthEnabled(enabled) {
    jwtAuthEnabled = enabled;
}

export function isJwtAuthRequired() {
    return jwtAuthEnabled;
}

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
    // Without JWT auth there is no login to require, so every caller counts as
    // authenticated and the auth-gated features stay open
    if (!jwtAuthEnabled) return true;
    return !!getToken();
}

async function publicRequest(name, body) {
    const config = apiConfig.requests[name];
    if (!config) {
        throw new Error(`Unknown request: ${name}`);
    }

    const response = await fetch(`${baseUrl}${config.endpoint}`, {
        method: config.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`${name} failed: ${response.status}`);
    }

    return response.json();
}

export async function login(email, password) {
    clearToken();
    const data = await publicRequest('login', { email, password });
    setToken(data.access_token);
}

export async function logout() {
    clearToken();
}

export async function requestOneTimeCode(email) {
    const data = await publicRequest('forgot_password', { email });
    return data.message;
}

export async function submitNewPassword(email, code, password) {
    const data = await publicRequest('reset_password', { email, code, password });
    return data.message;
}