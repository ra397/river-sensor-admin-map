// Module that initializes Google Maps map and exports it

import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

setOptions({ key: import.meta.env.VITE_GOOGLE_MAPS_KEY });

const libs = import.meta.env.VITE_GOOGLE_MAPS_LIBS.split(',').map(l => l.trim());
await Promise.all(libs.map(lib => importLibrary(lib)));

const mapEl = document.getElementById('map');
const mapMenus = Array.from(mapEl.children); // take snapshot before Google Maps API wipes #map container

export const map = new google.maps.Map(mapEl, {
    zoom: 8,
    minZoom: 5,
    maxZoom: 18,
    clickableIcons: false,
    streetViewControl: false,
    cameraControl: false,
    fullscreenControl: false,
    mapTypeControl: false,
});

const stateBordersSrc = `${import.meta.env.BASE_URL}assets/state_borders.geojson`;
const res = await fetch(stateBordersSrc);
const decompressed = res.body.pipeThrough(new DecompressionStream("gzip"));
const geojson = await new Response(decompressed).json();
map.data.addGeoJson(geojson);
map.data.setStyle({
    strokeColor: "#000",
    strokeWeight: 0.35,
    strokeOpacity: 0.7,
    fillOpacity: 0.0,
    clickable: false,
});

// Add menus
mapMenus.forEach(el => mapEl.appendChild(el));