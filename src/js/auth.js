import { apiConfig } from "./importApiConfig.js";

const TOKEN_KEY = 'access_token';
const baseUrl = apiConfig[apiConfig.mode];

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