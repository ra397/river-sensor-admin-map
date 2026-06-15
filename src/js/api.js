import { getToken, setToken, clearToken } from './auth.js';
import { apiConfig } from "./importApiConfig.js";

// const baseUrl = apiConfig[apiConfig.mode];
const baseUrl = '/api2';

function buildUrl(endpoint, pathParams = {}, queryParams = {}) {
    let path = endpoint;

    for (const [key, value] of Object.entries(pathParams)) {
        path = path.replace(`:${key}`, encodeURIComponent(value));
    }

    const query = new URLSearchParams(queryParams).toString();
    return `${baseUrl}${path}${query ? `?${query}` : ''}`;
}

export async function request(name, { pathParams = {}, queryParams = {}, body = null } = {}) {
    const config = apiConfig['requests'][name];
    if (!config) {
        throw new Error(`Unknown request: ${name}`);
    }

    const headers = {};
    const token = getToken();

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
        headers['Content-Type'] = 'application/json';
    }

    const url = buildUrl(config.endpoint, pathParams, queryParams);

    const response = await fetch(url, {
        method: config.method,
        headers,
        body: body ? JSON.stringify(body) : null,
    });

    // Handle token refresh
    const newToken = response.headers.get('X-New-Token');
    if (newToken) {
        setToken(newToken);
    }

    // Handle unauthorized - redirect to the login
    if (response.status === 401) {
        clearToken();
        window.location.reload();
        return;
    }

    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
    }

    return response.json();
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

export async function editTicket(id, data) {
    return request('edit_ticket', { pathParams: { id }, body: data });
}