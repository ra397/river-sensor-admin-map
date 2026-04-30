// Module that initializes Google Maps map and exports it

import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

setOptions({ key: import.meta.env.VITE_GOOGLE_MAPS_KEY });

const libs = import.meta.env.VITE_GOOGLE_MAPS_LIBS.split(',').map(l => l.trim());
await Promise.all(libs.map(lib => importLibrary(lib)));

export const map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 42.0656, lng: -93.38978 },
    zoom: 8,
    minZoom: 5,
    maxZoom: 18,
    mapId: import.meta.env.VITE_GOOGLE_MAPS_ID,
    clickableIcons: false,
});

const stateBordersSrc = `${import.meta.env.BASE_URL}/assets/state_borders.geojson.gz`;
const res = await fetch(stateBordersSrc);
const geojson = await res.json();
map.data.addGeoJson(geojson);
map.data.setStyle({
    strokeColor: "#000",
    strokeWeight: 0.35,
    strokeOpacity: 0.7,
    fillOpacity: 0.0,
    clickable: false,
});