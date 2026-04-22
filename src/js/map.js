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
});