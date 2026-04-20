import { getToken, setToken, clearToken } from './auth/auth.js';

export async function request(method, path, body = null) {
    const headers = {};
    const token = getToken();

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`/hydroiowa/api${path}`, {
        method,
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
        request('GET', '/observatories'),
        request('GET', '/sensors'),
        request('GET', '/packets/latest_observation'),
        request('GET', '/packets/daily-min-voltage'),
        request('GET', '/packets/no-packet-days'),
        request('GET', '/tickets'),
    ]);

    const sensorBySid      = Object.fromEntries(sensors.map(s => [s.sid, s]));
    const latestObsByOid   = Object.fromEntries(latestObs.map(o => [o.oid, o]));
    const voltageBySid     = Object.fromEntries(voltages.map(v => [v.sid, v]));
    const noPacketDaysByOid= Object.fromEntries(noPacketDays.map(o => [o.oid, o]));
    const ticketsByObsName = tickets.reduce((acc, t) => {
        const { observatory, sensor_id, ...rest } = t;
        (acc[observatory] ??= []).push(rest);
        return acc;
    }, {});

    return observatories.map(obs => {
        const { sid, status, ...obsRest } = obs;
        const sensor  = sensorBySid[sid] ?? null;

        const { sid: _sid, ...voltageRest } = voltageBySid[sensor?.sid] ?? {};
        const voltage = sensor ? (Object.keys(voltageRest).length ? voltageRest : null) : null;
        const noPacketDays = noPacketDaysByOid[obs.oid]?.days ?? null;

        return {
            ...obsRest,
            ...sensor,
            voltage: voltage?.minV_14 ?? null,
            latest_observation: latestObsByOid[obs.oid]?.dt_time ?? null,
            no_packet_days: noPacketDays ? noPacketDays : null,
            tickets: ticketsByObsName[obs.name] ?? [],
        };
    });
}