import { decode } from 'geobuf';
import { PbfReader } from 'pbf';
import { map } from './map.js';
import { showToast } from './toast.js';

/* ------------------------------------------------------------------ *
 * Configuration
 * ------------------------------------------------------------------ */

// Pre-built boundaries live in public/<directory>/<siteId>.pbf as geobuf.
// Only USGS has a service to fall back on when the file is missing.
const SOURCES = {
    ifc: {
        directory: 'ifcBasinBoundaries'
    },
    usgs: {
        directory: 'usgsBasinBoundaries',
        remoteUrl: siteId => `https://api.water.usgs.gov/nldi/linked-data/nwissite/USGS-${siteId}/basin?f=json`
    }
};

const BASIN_STYLE = {
    strokeColor: '#ef6c00',
    strokeWeight: 2,
    strokeOpacity: 0.9,
    fillColor: '#ef6c00',
    fillOpacity: 0.12,
    // Clicks belong to the markers sitting on top of the basin, never to the basin.
    clickable: false,
    zIndex: 1
};

const LOAD_ERROR_MESSAGE = 'Unable to load the basin boundary.';

/* ------------------------------------------------------------------ *
 * Module state
 * ------------------------------------------------------------------ */

// A single layer is what keeps exactly one basin on the map, for every marker set.
const layer = new google.maps.Data({ map, style: BASIN_STYLE });

// `${source}:${siteId}` -> GeoJSON, or null when the site has no boundary at all.
const cache = new Map();

let currentSource = null;
let currentKey = null;

// Guards against a slow boundary for basin A landing after basin B was picked.
let requestToken = 0;
let requestController = null;

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export async function showBasin(source, id) {
    const siteId = toSiteId(id);
    const key = `${source}:${siteId}`;

    if (key === currentKey) return;

    // Newest selection always wins.
    const token = ++requestToken;
    requestController?.abort();
    const controller = new AbortController();
    requestController = controller;

    // The basin on screen belongs to the previous selection, so it goes right away.
    clear();

    try {
        const geojson = await loadBasin(source, siteId, controller.signal);

        if (token !== requestToken) return;

        // A site without a boundary simply leaves the map empty.
        if (geojson) render(source, key, geojson);
    } catch (error) {
        if (token !== requestToken || isAbort(error)) return;

        console.error(`Basin boundary for ${key} could not be loaded`, error);
        showToast(LOAD_ERROR_MESSAGE);
    }
}

// Without a source the basin goes whatever it is; with one it goes only if it came from there.
export function clearBasin(source = null) {
    if (source !== null && currentSource !== source) return;

    requestToken++;
    requestController?.abort();
    requestController = null;

    clear();
}

/* ------------------------------------------------------------------ *
 * Loading
 * ------------------------------------------------------------------ */

async function loadBasin(source, siteId, signal) {
    const key = `${source}:${siteId}`;
    if (cache.has(key)) return cache.get(key);

    const config = SOURCES[source];
    if (!config) throw new Error(`Unknown basin source "${source}"`);

    const geojson =
        await fetchStaticBasin(config.directory, siteId, signal) ??
        (config.remoteUrl ? await fetchRemoteBasin(config.remoteUrl(siteId), signal) : null);

    // A miss is cached too, so an absent boundary is looked for only once.
    cache.set(key, geojson);

    return geojson;
}

async function fetchStaticBasin(directory, siteId, signal) {
    const url = `${import.meta.env.BASE_URL}${directory}/${encodeURIComponent(siteId)}.pbf`;

    const response = await fetch(url, { signal });

    // No pre-built file is the ordinary case, not a failure. The dev server answers
    // a missing one with the SPA fallback page, so a 200 alone does not mean geobuf.
    if (!response.ok) return null;
    if (response.headers.get('content-type')?.includes('text/html')) return null;

    const buffer = await response.arrayBuffer();

    try {
        return toBasinGeoJson(decode(new PbfReader(new Uint8Array(buffer))));
    } catch (error) {
        // An unreadable file is still a missing boundary, so the fallback keeps its chance.
        console.warn(`Static basin boundary at ${url} could not be decoded`, error);
        return null;
    }
}

async function fetchRemoteBasin(url, signal) {
    const response = await fetch(url, { signal });

    if (!response.ok) {
        // NLDI answers an unknown site with 404; anything else is a real failure.
        if (response.status === 404) return null;

        throw new Error(`The basin service responded with ${response.status}.`);
    }

    return toBasinGeoJson(await response.json());
}

// Anything that is not a drawable GeoJSON document is treated as no boundary.
function toBasinGeoJson(value) {
    const type = value?.type;

    const features =
        type === 'FeatureCollection' ? value.features :
        type === 'Feature' ? [value] :
        null;

    if (!Array.isArray(features)) return null;

    // Geobuf drops an empty `properties`, which the Data layer expects to be there.
    const drawable = features
        .filter(feature => feature?.geometry)
        .map(feature => ({ ...feature, properties: feature.properties ?? {} }));

    return drawable.length > 0 ? { type: 'FeatureCollection', features: drawable } : null;
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

function render(source, key, geojson) {
    layer.addGeoJson(geojson);

    currentSource = source;
    currentKey = key;
}

function clear() {
    // The collection is collected first, because removing while iterating it skips features.
    const features = [];
    layer.forEach(feature => features.push(feature));
    for (const feature of features) layer.remove(feature);

    currentSource = null;
    currentKey = null;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

// USGS markers carry ids like "USGS-05051500", while boundaries are keyed by the bare site number.
function toSiteId(id) {
    return String(id).replace(/^USGS-/i, '');
}

function isAbort(error) {
    return error?.name === 'AbortError';
}
