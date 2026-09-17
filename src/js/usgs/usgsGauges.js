import { Markers } from '../marker.js';
import { showToast } from '../toast.js';
import { showGaugePlot, showGaugeMessage, showGaugeLoading } from './usgsPlot.js';
import {activateMarkerGroup, registerMarkerGroup} from "../markerGroups.js";
import { showBasin, clearBasin } from "../basins.js";

/* ------------------------------------------------------------------ *
 * Configuration
 * ------------------------------------------------------------------ */

const USGS_BASE_URL = 'https://api.waterdata.usgs.gov/ogcapi/v1';

const STATE_CODE = '38';          // North Dakota
const PARAMETER_CODE = '00065';   // Gage height

const REQUEST_TIMEOUT_MS = 3500;
const LOCATION_PAGE_SIZE = 500;
const OBSERVATION_PAGE_SIZE = 2880;
const MAX_PAGES = 50;             // pagination runaway guard

const API_KEY_STORAGE_KEY = 'usgs-waterdata-api-key';
const API_KEY_PROMPTED_SESSION_KEY = 'usgs-waterdata-api-key-prompted';

const SIGNUP_URL = 'https://api.waterdata.usgs.gov/signup/';
const API_KEY_DOCS_URL = 'https://api.waterdata.usgs.gov/docs/ogcapi/keys/';

const GAUGE_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">' +
    '<circle cx="8" cy="8" r="5" fill="#00843D" stroke="#ffffff" stroke-width="2"/></svg>';

const SELECTED_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">' +
    '<circle cx="14" cy="14" r="11" fill="#ef6c00" fill-opacity="0.25"/>' +
    '<circle cx="14" cy="14" r="7" fill="#ef6c00" stroke="#ffffff" stroke-width="3"/></svg>';

const GENERIC_ERROR_MESSAGE = "Unable to load this gauge's data.";
const NO_DATA_MESSAGE = 'No gage-height data is available for the past 30 days.';
const NO_VALID_DATA_MESSAGE = 'No valid gage-height data is available for the past 30 days.';
const TIMEOUT_MESSAGE = 'The USGS service timed out. You can provide an API key to increase rate limits.';
const INVALID_KEY_MESSAGE = 'The USGS API key is invalid. Please enter a valid API key.';

/* ------------------------------------------------------------------ *
 * Module state
 * ------------------------------------------------------------------ */
let markers = null;

// gaugeId -> { siteName, maxY, maxYFromUsgs, unit, points }
const gaugeCache = new Map();

// Guards against a slow request for gauge A overwriting the chart for gauge B.
let selectionToken = 0;
let selectionController = null;

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export async function initUsgsGauges(map) {
    markers = new Markers(map, {
        style: GAUGE_SVG,
        selectedStyle: SELECTED_SVG,
        onClick: handleGaugeClick
    });

    registerMarkerGroup(markers, [
        document.querySelector('#usgs-plot-container'), // your gauge plot panel
    ]);

    try {
        const gauges = await loadGaugeLocations();

        if (gauges.length === 0) {
            showToast('No USGS gauges were returned for North Dakota.');
            return;
        }

        markers.add(gauges);
        markers.hideAll();
    } catch (error) {
        // The rest of the application keeps working; the map simply has no gauges.
        console.error('USGS gauge locations could not be loaded', error);
        showToast(describeError(error, 'Unable to load USGS gauge locations.'));
    }

    return markers;
}

/* ------------------------------------------------------------------ *
 * Initialization
 * ------------------------------------------------------------------ */

async function loadGaugeLocations() {
    const url = buildUrl('collections/latest-continuous/items', {
        state_code: STATE_CODE,
        parameter_code: PARAMETER_CODE,
        properties: 'monitoring_location_id',
        limit: LOCATION_PAGE_SIZE
    });

    const features = await fetchAllPages(url, createRequestContext());

    const gauges = [];
    const seen = new Set();

    for (const feature of features) {
        const gauge = toGauge(feature);

        // Malformed features are skipped, never fatal.
        if (!gauge || seen.has(gauge.id)) continue;

        seen.add(gauge.id);
        gauges.push(gauge);
    }

    return gauges;
}

function toGauge(feature) {
    const id = feature?.properties?.monitoring_location_id;
    if (typeof id !== 'string' || id.length === 0) return null;

    const geometry = feature.geometry;
    if (geometry?.type !== 'Point' || !Array.isArray(geometry.coordinates)) return null;

    // GeoJSON is [longitude, latitude].
    const lng = Number(geometry.coordinates[0]);
    const lat = Number(geometry.coordinates[1]);

    if (!Number.isFinite(lng) || Math.abs(lng) > 180) return null;
    if (!Number.isFinite(lat) || Math.abs(lat) > 90) return null;

    return { id, lat, lng };
}

/* ------------------------------------------------------------------ *
 * Marker click
 * ------------------------------------------------------------------ */

async function handleGaugeClick(marker) {
    const gaugeId = marker.id;
    activateMarkerGroup(markers);

    // Newest selection always wins.
    const token = ++selectionToken;
    selectionController?.abort();
    const controller = new AbortController();
    selectionController = controller;

    markers.select(gaugeId);
    showBasin('usgs', gaugeId);

    try {
        const cached = gaugeCache.get(gaugeId);
        if (cached) {
            plotGauge(gaugeId, cached);
            return;
        }

        showGaugeLoading();

        const context = createRequestContext(controller.signal);

        // Independent requests, so they run concurrently under one shared key/abort state.
        const [siteName, threshold, features] = await Promise.all([
            fetchGaugeName(gaugeId, context),
            fetchGaugeMaxThreshold(gaugeId, context),
            fetchGaugeObservations(gaugeId, context)
        ]);

        if (isStale(token)) return;

        if (features.length === 0) {
            showGaugeMessage(NO_DATA_MESSAGE);
            return;
        }

        const { points, unit } = parseGaugePoints(features);

        if (points.length === 0) {
            showGaugeMessage(NO_VALID_DATA_MESSAGE);
            return;
        }

        const maxYFromUsgs = Number.isFinite(threshold) && threshold > 0;
        const entry = {
            siteName: siteName || gaugeId,
            unit,
            points,
            maxYFromUsgs,
            maxY: maxYFromUsgs ? threshold : fallbackMaxY(points)
        };

        gaugeCache.set(gaugeId, entry);
        plotGauge(gaugeId, entry);
    } catch (error) {
        if (isStale(token) || isAbort(error)) return;

        console.error(`USGS gauge ${gaugeId} could not be loaded`, error);
        showGaugeMessage(describeError(error, GENERIC_ERROR_MESSAGE));
    }
}

function plotGauge(gaugeId, entry) {
    showGaugePlot({ id: gaugeId, siteName: entry.siteName }, entry.points, entry.unit, entry.maxY);
}

function isStale(token) {
    return token !== selectionToken;
}

/* ------------------------------------------------------------------ *
 * Gauge detail requests (lazy, one gauge at a time)
 * ------------------------------------------------------------------ */

async function fetchGaugeName(gaugeId, context) {
    const url = buildUrl('collections/monitoring-locations/items', {
        id: gaugeId,
        limit: 1,
        skipGeometry: true
    });

    const body = await fetchUsgs(url, context);
    const name = body?.features?.[0]?.properties?.monitoring_location_name;

    return typeof name === 'string' && name.length > 0 ? name : null;
}

async function fetchGaugeMaxThreshold(gaugeId, context) {
    const url = buildUrl('collections/time-series-metadata/items', {
        monitoring_location_id: gaugeId,
        parameter_code: PARAMETER_CODE,
        skipGeometry: true
    });

    const body = await fetchUsgs(url, context);

    return getMaxYFromMetadata(body);
}

async function fetchGaugeObservations(gaugeId, context) {
    const url = buildUrl('collections/continuous/items', {
        monitoring_location_id: gaugeId,
        parameter_code: PARAMETER_CODE,
        time: 'P30D',
        skipGeometry: true,
        limit: OBSERVATION_PAGE_SIZE
    });

    return fetchAllPages(url, context);
}

/* ------------------------------------------------------------------ *
 * Metadata parsing
 * ------------------------------------------------------------------ */

// Picks the continuous instantaneous gage-height series and its upper operational limit.
function getMaxYFromMetadata(body) {
    const features = Array.isArray(body?.features) ? body.features : [];

    const series =
        features.find(feature => isInstantaneousPointsSeries(feature?.properties)) ??
        features.find(feature => feature?.properties?.statistic_id === '00011');

    const thresholds = series?.properties?.thresholds;
    if (!Array.isArray(thresholds)) return null;

    const upper = thresholds
        .map(threshold => ({ threshold, value: thresholdReferenceValue(threshold) }))
        .filter(candidate => candidate.value !== null && isUpperThreshold(candidate.threshold))
        .sort((a, b) => thresholdRank(b.threshold) - thresholdRank(a.threshold))[0];

    return upper ? upper.value : null;
}

function isInstantaneousPointsSeries(properties) {
    return properties?.parameter_code === PARAMETER_CODE
        && properties?.statistic_id === '00011'
        && properties?.computation_period_identifier === 'Points'
        && properties?.computation_identifier === 'Instantaneous';
}

function isUpperThreshold(threshold) {
    if (threshold?.Type === 'ThresholdBelow') return false;

    const name = String(threshold?.Name ?? '').toLowerCase();

    // Explicit lower limits ("LOW", "Operational limit (minimum)") are never a plot maximum.
    if (name.includes('minimum') || name.includes('low')) return false;

    return threshold?.Type === 'ThresholdAbove' || name.includes('maximum') || name.includes('max');
}

// Prefers a named maximum operational limit over any other upper threshold.
function thresholdRank(threshold) {
    const name = String(threshold?.Name ?? '').toLowerCase();

    if (name.includes('operational limit') && (name.includes('maximum') || name.includes('max'))) return 3;
    if (name.includes('maximum') || name.includes('max')) return 2;
    if (threshold?.Type === 'ThresholdAbove') return 1;

    return 0;
}

// Uses the period that applies right now, falling back to any period carrying a value.
function thresholdReferenceValue(threshold) {
    const periods = Array.isArray(threshold?.Periods) ? threshold.Periods : [];
    const now = Date.now();

    const applicable = periods.find(period => {
        if (!Number.isFinite(Number(period?.ReferenceValue))) return false;

        const start = Date.parse(period?.StartTime);
        const end = Date.parse(period?.EndTime);

        if (Number.isFinite(start) && start > now) return false;
        if (Number.isFinite(end) && end < now) return false;

        return true;
    }) ?? periods.find(period => Number.isFinite(Number(period?.ReferenceValue)));

    if (!applicable) return null;

    const value = Number(applicable.ReferenceValue);

    return Number.isFinite(value) && value > 0 ? value : null;
}

/* ------------------------------------------------------------------ *
 * Observation parsing
 * ------------------------------------------------------------------ */

function parseGaugePoints(features) {
    const byIdentity = new Map();
    let unit = null;

    for (const feature of features) {
        const properties = feature?.properties;
        if (!properties) continue;

        const time = new Date(properties.time);
        if (Number.isNaN(time.getTime())) continue;

        const raw = properties.value;
        if (raw === null || raw === undefined || String(raw).trim() === '') continue;

        const value = Number(raw);
        if (!Number.isFinite(value)) continue;

        // An observation is identified by its series plus its timestamp, never by its value.
        const identity = `${properties.time_series_id ?? ''}|${time.getTime()}`;
        if (byIdentity.has(identity)) continue;

        byIdentity.set(identity, { x: time, y: value });

        if (!unit && typeof properties.unit_of_measure === 'string') {
            unit = properties.unit_of_measure;
        }
    }

    const points = [...byIdentity.values()].sort((a, b) => a.x.getTime() - b.x.getTime());

    return { points, unit };
}

// Only used when USGS metadata carries no usable upper threshold.
function fallbackMaxY(points) {
    const max = points.reduce((highest, point) => Math.max(highest, point.y), 0);

    return max > 0 ? max * 1.1 : 1;
}

/* ------------------------------------------------------------------ *
 * Requests
 * ------------------------------------------------------------------ */

function buildUrl(path, params) {
    const url = new URL(`${USGS_BASE_URL}/${path}`);

    url.searchParams.set('f', 'json');

    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value));
    }

    return url.toString();
}

async function fetchAllPages(firstUrl, context) {
    const requested = new Set();
    const features = [];

    let url = firstUrl;

    while (url && !requested.has(url) && requested.size < MAX_PAGES) {
        requested.add(url);

        const body = await fetchUsgs(url, context);

        if (Array.isArray(body?.features)) {
            for (const feature of body.features) features.push(feature);
        }

        url = nextPageUrl(body, url);
    }

    return features;
}

// USGS supplies the exact cursor URL; reconstructing pagination ourselves is fragile.
function nextPageUrl(body, currentUrl) {
    const links = Array.isArray(body?.links) ? body.links : [];
    const next = links.find(link => link?.rel === 'next' && typeof link.href === 'string');

    if (!next) return null;

    try {
        return new URL(next.href, currentUrl).toString();
    } catch {
        return null;
    }
}

// Per-operation recovery state: one API-key prompt, one retry, shared by concurrent requests.
function createRequestContext(signal = null) {
    return { signal, invalidKeyRecovery: null, timeoutRecovery: null };
}

async function fetchUsgs(url, context) {
    try {
        return await fetchJsonWithTimeout(url, context.signal);
    } catch (error) {
        if (isAbort(error) || !(await recoverFromError(error, context))) throw error;

        // Exactly one retry per request, so recovery can never loop.
        return fetchJsonWithTimeout(url, context.signal);
    }
}

async function recoverFromError(error, context) {
    if (error?.kind === 'invalid-key') {
        context.invalidKeyRecovery ??= runInvalidKeyRecovery();
        await context.invalidKeyRecovery;

        // The bad key is gone either way, so the retry is worth making.
        return true;
    }

    if (error?.kind === 'timeout') {
        // A timeout may just be the unauthenticated rate limit; a key raises it.
        context.timeoutRecovery ??= runTimeoutRecovery();
        return context.timeoutRecovery;
    }

    return false;
}

async function runInvalidKeyRecovery() {
    clearStoredApiKey();
    showToast(INVALID_KEY_MESSAGE);

    const key = await openApiKeyModal({ invalid: true });
    if (key) saveApiKey(key);
}

async function runTimeoutRecovery() {
    const key = await openApiKeyModal({ timedOut: true });
    if (!key) return false;

    saveApiKey(key);
    return true;
}

async function fetchJsonWithTimeout(url, externalSignal) {
    const controller = new AbortController();
    let timedOut = false;

    const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, REQUEST_TIMEOUT_MS);

    const unlink = linkSignal(externalSignal, controller);

    let response;

    try {
        response = await fetch(url, {
            signal: controller.signal,
            headers: apiKeyHeaders()
        });
    } catch (error) {
        if (timedOut) throw usgsError('timeout', 'The USGS request timed out.');
        if (externalSignal?.aborted || isAbort(error)) throw usgsError('aborted', 'The USGS request was cancelled.');

        throw usgsError('network', 'The USGS service could not be reached.', { cause: error });
    } finally {
        clearTimeout(timeout);
        unlink();
    }

    // USGS answers an invalid key with HTML, so the body is read as text first.
    const text = await response.text();

    if (!response.ok) {
        if (text.includes('API_KEY_INVALID')) {
            throw usgsError('invalid-key', 'The USGS API key was rejected.');
        }

        throw usgsError('http', `The USGS service responded with ${response.status}.`, { status: response.status });
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        throw usgsError('invalid-json', 'The USGS response could not be parsed.', { cause: error });
    }
}

function apiKeyHeaders() {
    const key = getStoredApiKey();

    // An empty X-Api-Key header is worse than none at all.
    return key ? { 'X-Api-Key': key } : {};
}

function linkSignal(externalSignal, controller) {
    if (!externalSignal) return () => {};

    if (externalSignal.aborted) {
        controller.abort();
        return () => {};
    }

    const onAbort = () => controller.abort();
    externalSignal.addEventListener('abort', onAbort, { once: true });

    return () => externalSignal.removeEventListener('abort', onAbort);
}

function usgsError(kind, message, details = {}) {
    const error = new Error(message, details.cause ? { cause: details.cause } : undefined);

    error.name = 'UsgsError';
    error.kind = kind;
    if (details.status !== undefined) error.status = details.status;

    return error;
}

function isAbort(error) {
    return error?.kind === 'aborted' || error?.name === 'AbortError';
}

function describeError(error, fallback) {
    if (error?.kind === 'timeout') return TIMEOUT_MESSAGE;

    return fallback;
}

/* ------------------------------------------------------------------ *
 * API key storage
 * ------------------------------------------------------------------ */

function getStoredApiKey() {
    return readStorage(localStorage, API_KEY_STORAGE_KEY) || null;
}

function saveApiKey(key) {
    writeStorage(localStorage, API_KEY_STORAGE_KEY, key);
}

function clearStoredApiKey() {
    removeStorage(localStorage, API_KEY_STORAGE_KEY);
}

function readStorage(storage, key) {
    try {
        return storage.getItem(key);
    } catch {
        return null;
    }
}

function writeStorage(storage, key, value) {
    try {
        storage.setItem(key, value);
    } catch {
        // Ignored: an unstored key only means it is not remembered next time.
    }
}

function removeStorage(storage, key) {
    try {
        storage.removeItem(key);
    } catch {
        // Storage can be unavailable (private mode, blocked cookies); the feature still works.
    }
}

// In-memory fallback for when sessionStorage is unavailable.
let promptedThisPage = false;

function wasPromptedThisSession() {
    return promptedThisPage || readStorage(sessionStorage, API_KEY_PROMPTED_SESSION_KEY) === 'true';
}

function markPrompted() {
    promptedThisPage = true;
    writeStorage(sessionStorage, API_KEY_PROMPTED_SESSION_KEY, 'true');
}

// Asks once per session, and only when no key is stored.
// Asks once per session, and only when no key is stored.
async function promptForApiKeyIfNeeded() {
    if (getStoredApiKey() || wasPromptedThisSession()) return;

    const key = await openApiKeyModal();
    if (key) saveApiKey(key);
}

/* ------------------------------------------------------------------ *
 * API key modal
 * ------------------------------------------------------------------ */

let apiKeyDialog = null;
let pendingApiKeyPrompt = null;

function openApiKeyModal({ invalid = false, timedOut = false } = {}) {
    // Concurrent failures share a single prompt instead of stacking modals.
    if (pendingApiKeyPrompt) return pendingApiKeyPrompt;

    markPrompted();

    const dialog = createApiKeyModal();

    if (!dialog) {
        const key = window.prompt('USGS API key (optional)');
        return Promise.resolve(key ? key.trim() : null);
    }

    dialog.querySelector('.usgs-api-key-notice').textContent = invalid
        ? INVALID_KEY_MESSAGE
        : timedOut
            ? 'The USGS service did not respond in time. An API key raises your rate limit.'
            : '';

    const input = dialog.querySelector('#usgs-api-key-input');
    input.value = '';

    pendingApiKeyPrompt = new Promise(resolve => {
        dialog.addEventListener('close', () => {
            const key = dialog.returnValue === 'confirm' ? input.value.trim() : '';

            input.value = '';
            pendingApiKeyPrompt = null;

            resolve(key || null);
        }, { once: true });

        // returnValue can survive a previous close, so a fresh Escape always reads as Cancel.
        dialog.returnValue = '';
        dialog.showModal();
        input.focus();
    });

    return pendingApiKeyPrompt;
}

// Built once and reused, so repeated prompts never duplicate DOM.
function createApiKeyModal() {
    if (apiKeyDialog) return apiKeyDialog;
    if (typeof HTMLDialogElement === 'undefined') return null;

    const dialog = document.createElement('dialog');
    dialog.className = 'usgs-api-key-dialog';
    dialog.setAttribute('aria-labelledby', 'usgs-api-key-title');

    dialog.innerHTML = `
        <form method="dialog">
            <h2 id="usgs-api-key-title">Get an API key to view USGS data</h2>
            <p class="usgs-api-key-notice" role="alert"></p>
            <p>
                The USGS Water Data APIs can be used without a key. Providing one gives you
                higher rate limits, which helps when the map makes many requests. You can
                continue without a key.
            </p>
            <p>
                Register at <a href="${SIGNUP_URL}" target="_blank" rel="noopener noreferrer">${SIGNUP_URL}</a>
                and USGS will email your API key. See the
                <a href="${API_KEY_DOCS_URL}" target="_blank" rel="noopener noreferrer">API key documentation</a>
                for details.
            </p>
            <label for="usgs-api-key-input">USGS API key</label>
            <input id="usgs-api-key-input" autocomplete="off"
                   autocapitalize="off" autocorrect="off" spellcheck="false">
            <menu>
                <button type="button" class="usgs-api-key-cancel" value="cancel">Proceed without Key</button>
                <button type="submit" class="usgs-api-key-confirm" value="confirm">Confirm</button>
            </menu>
        </form>
    `;

    // Cancel is not a submit button, so Enter in the input always confirms.
    dialog.querySelector('.usgs-api-key-cancel')
        .addEventListener('click', () => dialog.close('cancel'));

    // Escape fires 'cancel' and closes with an empty returnValue, which reads as Cancel.
    document.body.appendChild(dialog);
    apiKeyDialog = dialog;

    return dialog;
}

document.querySelector('input[name="usgs-toggle"]').addEventListener('change', async (e) => {
    if (!markers) return;

    if (e.target.checked) {
        await promptForApiKeyIfNeeded();
        markers.showAll();
    } else {
        markers.hideAll();

        // A hidden gauge must not leave its basin behind.
        clearBasin('usgs');
    }
});