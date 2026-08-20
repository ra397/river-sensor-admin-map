import { getToken, setToken, clearToken, isJwtAuthRequired, DEMO_USER_EMAIL } from './auth.js';
import { promptLogin } from './authUI.js';
import { baseUrl, apiConfig } from "./importApiConfig.js";

function buildUrl(endpoint, pathParams = {}, queryParams = {}) {
    let path = endpoint;

    for (const [key, value] of Object.entries(pathParams)) {
        path = path.replace(`:${key}`, encodeURIComponent(value));
    }

    const query = new URLSearchParams(queryParams).toString();
    return `${baseUrl}${path}${query ? `?${query}` : ''}`;
}

function storeRefreshedToken(response) {
    const newToken = response.headers.get('X-New-Token');
    if (newToken) {
        setToken(newToken);
    }
}

export async function request(name, { pathParams = {}, queryParams = {}, body = null } = {}) {
    const config = apiConfig['requests'][name];
    if (!config) {
        throw new Error(`Unknown request: ${name}`);
    }

    const url = buildUrl(config.endpoint, pathParams, queryParams);

    // Built per attempt so a replay picks up the token from the fresh login
    const send = () => {
        const headers = {};

        if (isJwtAuthRequired()) {
            const token = getToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        } else {
            // No JWT to send, the backend identifies the caller by this header
            headers['user-email'] = DEMO_USER_EMAIL;
        }

        if (body) {
            headers['Content-Type'] = 'application/json';
        }

        return fetch(url, {
            method: config.method,
            headers,
            body: body ? JSON.stringify(body) : null,
        });
    };

    let response = await send();
    storeRefreshedToken(response);

    // Handle unauthorized - ask for a login in place, then replay the request.
    // With JWT auth off there is nothing to log in with, so let it fall through.
    if (response.status === 401 && isJwtAuthRequired()) {
        clearToken();
        const loggedIn = await promptLogin();
        if (!loggedIn) {
            throw new Error('Authentication required');
        }
        response = await send();
        storeRefreshedToken(response);
    }

    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
    }

    return response.json();
}

export class ApiError extends Error {
    constructor(message, { code = null, httpCode = null } = {}) {
        super(message);
        this.name = 'ApiError';
        this.code = code;        // application error code (110, 111, 112, 113)
        this.httpCode = httpCode; // logical http code carried inside the envelope
    }
}

// The notification endpoints always answer HTTP 200 and carry the real outcome
// in the body as [payload, code]. Never treat HTTP 200 as success here.
async function envelopeRequest(name, options = {}) {
    const response = await request(name, options);

    if (!Array.isArray(response) || response.length !== 2) {
        throw new ApiError('Unexpected response from the server.');
    }

    const [payload, code] = response;

    if (code !== 200) {
        throw new ApiError(payload?.message || 'The request could not be completed.', {
            code: payload?.code ?? null,
            httpCode: code,
        });
    }

    return payload;
}

export async function getObservatoryData() {
    const [observatories, sensors, latestObs, voltages, noPacketDays, tickets] = await Promise.all([
        request('observatories'),
        request('sensors'),
        request('latest_observation'),
        request('daily_min_voltage'),
        request('no_packet_days'),
        request('active_tickets'),
    ]);

    const sensorBySid       = Object.fromEntries(sensors.map(s => [s.sid, s]));
    const latestObsByOid    = Object.fromEntries(latestObs.map(o => [o.oid, o]));
    const voltageBySid      = Object.fromEntries(voltages.map(v => [v.sid, v]));
    const noPacketDaysByOid = Object.fromEntries(noPacketDays.map(o => [o.oid, o]));
    const ticketsByObsName  = tickets.reduce((acc, t) => {
        const { observatory, sensor_id, ...rest } = t;
        (acc[observatory] ??= []).push(rest);
        return acc;
    }, {});

    return observatories.map(obs => {
        const { sid, status, ...obsRest } = obs;
        const sensor = sensorBySid[sid] ?? null;

        const { sid: _sid, ...voltageRest } = voltageBySid[sensor?.sid] ?? {};
        const voltage = sensor ? (Object.keys(voltageRest).length ? voltageRest : null) : null;
        const noPacketDays = noPacketDaysByOid[obs.oid]?.days ?? null;

        return {
            ...obsRest,
            ...sensor,
            status, // overwrite status field from sensor and take it from observatory
            voltage: voltage?.minV_14 ?? null,
            latest_observation: latestObsByOid[obs.oid]?.dt_time ?? null,
            no_packet_days: noPacketDays ?? null,
            tickets: ticketsByObsName[obs.name] ?? [],
        };
    });
}

export async function getReportData(variable, observatoryId, startDate, endDate) {
    return request('report', {
        pathParams: { variable, observatoryId },
        queryParams: { bdt: startDate, edt: endDate },
    });
}

export async function getBatteryReportData(observatoryId, years) {
    return request('battery-report', {
        pathParams: { observatoryId, years },
    });
}

export async function getTickets(observatoryName) {
    const tickets = await request('active_tickets');
    return tickets
        .filter(t => t.observatory === observatoryName)
        .map(({ observatory, sensor_id, ...rest }) => rest);
}

export async function createTicket(data) {
    return request('create_ticket', { body: data });
}

export async function editTicket(id, data) {
    return request('edit_ticket', { pathParams: { id }, body: data });
}

export async function getNotifications() {
    return envelopeRequest('notifications');
}

export async function getNotification(id) {
    return envelopeRequest('notification', { pathParams: { id } });
}

export async function createNotification(data) {
    return envelopeRequest('create_notification', { body: data });
}

export async function editNotification(id, data) {
    return envelopeRequest('edit_notification', { pathParams: { id }, body: data });
}

export async function deleteNotification(id) {
    return envelopeRequest('delete_notification', { pathParams: { id } });
}

export async function getMaintenanceCrew() {
    const crew = await request('maintenance_crew');
    return crew.map(item => item.fullname);
}

// Answers whether the backend enforces JWT auth. Deliberately bypasses request()
// so the bootstrap check carries no token and never triggers the login prompt.
export async function isJwtAuthEnabled() {
    const config = apiConfig['requests']['jwt_auth_enabled'];

    try {
        const response = await fetch(`${baseUrl}${config.endpoint}`, { method: config.method });
        if (!response.ok) {
            throw new Error(`Request failed: ${response.status}`);
        }
        const res = await response.json();
        return !!res.jwt_auth_enabled;
    } catch (err) {
        // Fail secure: keep the login flow when the status cannot be read
        console.error('Could not read the auth status, assuming JWT auth is enabled.', err);
        return true;
    }
}