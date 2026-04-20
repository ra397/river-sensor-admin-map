import { isAuthenticated } from "./js/auth/auth.js";
import { showView } from "./js/auth/authController.js";
import { initFilters } from "./js/filter.js";
import { map } from "./js/map.js";
import { MarkerCollection } from "./js/markerCollection.js";
import { getObservatoryData } from "./js/api.js";

async function initApp() {
    const observatories = await getObservatoryData();
    const bridgeSensorMarkers = new MarkerCollection(map);
    for (const observatory of observatories) {
        bridgeSensorMarkers.add(observatory.latitude, observatory.longitude, observatory);
    }
    bridgeSensorMarkers.setSize(3.5);
    bridgeSensorMarkers.onClick((marker) => {
        console.log(marker.properties);
    });
    initFilters(bridgeSensorMarkers);
}

// Listen for login event
window.addEventListener('auth:login', () => initApp());

// Entry
if (isAuthenticated()) {
    showView('main-view');
    await initApp();
} else {
    showView('login-view');
}