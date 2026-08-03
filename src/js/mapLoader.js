// js/mapsLoader.js
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

const configSrc = `${import.meta.env.BASE_URL}assets/maps-config.json`;
const { googleMapsApiKey } = await (await fetch(configSrc, { cache: 'no-store' })).json();
setOptions({ key: googleMapsApiKey });

const libs = import.meta.env.VITE_GOOGLE_MAPS_LIBS.split(',').map(l => l.trim());
export const libraries = Object.fromEntries(
    await Promise.all(libs.map(async l => [l, await importLibrary(l)]))
);