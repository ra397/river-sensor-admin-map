// Module that initializes Google Maps map and exports it

import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

setOptions({ key: import.meta.env.VITE_GOOGLE_MAPS_KEY });

const libs = import.meta.env.VITE_GOOGLE_MAPS_LIBS.split(',').map(l => l.trim());
await Promise.all(libs.map(lib => importLibrary(lib)));

export const map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 41.6611, lng: -91.5302 },
    zoom: 10,
    mapId: import.meta.env.VITE_GOOGLE_MAPS_ID,
});