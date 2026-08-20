import { map } from './js/map.js';
import { Markers } from "./js/marker.js";
import { getObservatoryData, isJwtAuthEnabled } from "./js/api.js";
import { setJwtAuthEnabled } from "./js/auth.js";
import { initSearch } from "./js/search.js";
import { initFilters } from "./js/filter.js";
import { colorByConfig, getColor } from "./js/colorByUI.js";
import { ColorBar } from "./js/ColorBar.js";
import { renderObservatoryInfoWindow } from "./js/renderObservatory.js";
import { updateReports } from "./js/plots.js";
import { showStreetView } from "./js/panorama.js";
import { makeDraggable } from "./js/draggableContainer.js";
import { renderManageTickets } from "./js/renderManageTickets.js";
import { renderNotifications } from "./js/renderNotifications.js";
import { initMapStyleControl } from "./js/mapStyles.js";

// The auth mode decides whether requests carry a token and whether the app
// forces a login, so settle it before anything talks to the backend
setJwtAuthEnabled(await isJwtAuthEnabled());

const renderObservatoryContainerEl = document.querySelector("#renderObservatoryContainer");

let observatories = [];
let markers = null;
let showPlots = false;
let showPanorama = false;

function getObservatory(oid) {
    return observatories.find(o => o.oid === oid) || null;
}

async function handleMarkerClick(marker) {
    markers.select(marker);
    const observatory = getObservatory(marker.getId());
    if (observatory) {
        await renderObservatoryInfoWindow(renderObservatoryContainerEl, observatory);
    }
    if (showPlots) {
        await updateReports(marker.getId());
    }
    if (showPanorama) {
        await showStreetView(marker.getPosition());
    }

    // The manage panels are scoped to one bridge, follow the selected marker
    const manageTicketsEl = document.querySelector('#manageTickets');
    if (!manageTicketsEl.classList.contains('hidden')) {
        if (observatory) {
            await renderManageTickets(manageTicketsEl, observatory);
        } else {
            manageTicketsEl.classList.add('hidden');
        }
    }

    const manageNotificationsEl = document.querySelector('#manageNotifications');
    if (!manageNotificationsEl.classList.contains('hidden')) {
        if (observatory) {
            await renderNotifications(manageNotificationsEl, observatory);
        } else {
            manageNotificationsEl.classList.add('hidden');
        }
    }
}

function initMarkers() {
    markers = new Markers({
        map: map,
        onClick: handleMarkerClick,
    });
    observatories.forEach((observatory) => {
        markers.add({
            id: observatory.oid,
            position: { lat: observatory.latitude, lng: observatory.longitude },
            color: 'green',
        });
    });
    map.setCenter(markers.getBoundingBox().getCenter());
}

async function loadObservatories() {
    const previouslySelectedMarkerId =  markers?.getSelected()?.getId() ?? null;
    observatories = await getObservatoryData();
    initMarkers();
    if (previouslySelectedMarkerId) {
        const marker = markers.get(previouslySelectedMarkerId);
        if (marker) {
            markers.select(marker);
            const observatory = getObservatory(previouslySelectedMarkerId);
            if (observatory) {
                await renderObservatoryInfoWindow(renderObservatoryContainerEl, observatory);
            }
        }
    }
}

await loadObservatories();

window.addEventListener("update:observatories", loadObservatories);

const bar = new ColorBar(document.getElementById('legend'));
window.addEventListener('colorby:change', (e) => {
    const { colorBy } = e.detail;
    // if null, go to default coloring, hide the legend

    if (colorBy === null) {
        markers.forEach((marker) => {
            marker.setColor('green');
        })
        bar.hide();
        return;
    }

    observatories.forEach((observatory) => {
        const markerColor = getColor(observatory[colorBy], colorByConfig[colorBy]);
        const marker = markers.get(observatory['oid']);
        if (marker) marker.setColor(markerColor);
    });

    bar.update(
        colorByConfig[colorBy].colors,
        colorByConfig[colorBy].ticks,
        colorByConfig[colorBy].title,
    );
    bar.show();
});

const plotContainer = document.querySelector('#plot-container');
const plotCheckbox = document.querySelector('input[name="plots"]');
plotCheckbox.addEventListener('change', async (e) => {
    showPlots = e.target.checked;
    if (showPlots) {
        const selectedMarker = markers.getSelected();
        if (selectedMarker) await updateReports(selectedMarker.getId());
    } else {
        plotContainer.classList.add('hidden');
    }
});
plotContainer.querySelector('.close-button').addEventListener('click', () => {
    showPlots = false;
    plotCheckbox.checked = false;
});

const panoContainer = document.querySelector('#pano-container');
const panoCheckbox = document.querySelector('input[name="panorama"]');
panoCheckbox.addEventListener('change', async (e) => {
   showPanorama = e.target.checked;
   if (showPanorama) {
       const selectedMarker = markers.getSelected();
       if (selectedMarker) await showStreetView(selectedMarker.getPosition());
   } else {
       panoContainer.classList.add('hidden');
   }
});

panoContainer.querySelector('.close-button').addEventListener('click', () => {
    showPanorama = false;
    panoCheckbox.checked = false;
});

initSearch(markers, map, observatories);
initFilters(markers, observatories);
makeDraggable(document.querySelectorAll('.draggable'));
initMapStyleControl(map);

// Sidebar toggle
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');

if (!localStorage.getItem('sidebarUsed')) {
    sidebarToggle.classList.add('hint');
}

sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    sidebarToggle.classList.remove('hint');
    localStorage.setItem('sidebarUsed', 'true');
});