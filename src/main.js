import { map } from './js/map.js';
import { Markers } from "./js/marker.js";
import { getObservatoryData } from "./js/api.js";
import { initSearch } from "./js/search.js";
import { initFilters } from "./js/filter.js";
import { colorByConfig, getColor } from "./js/colorByUI.js";
import { ColorBar } from "./js/ColorBar.js";
import { renderObservatoryInfoWindow } from "./js/renderObservatory.js";
import { updateReports } from "./js/plots.js";
import { showStreetView } from "./js/panorama.js";
import { makeDraggable } from "./js/draggableContainer.js";

const renderObservatoryContainerEl = document.querySelector("#renderObservatoryContainer");

const markers = new Markers({
    map: map,
    onClick: async (marker) => {
        markers.select(marker);
        const observatory = getObservatory(observatories, marker.getId());
        if (observatory) {
            renderObservatoryInfoWindow(renderObservatoryContainerEl, observatory);
        }
        if (showPlots) {
            await updateReports(marker.getId());
        }
        if (showPanorama) {
            await showStreetView(marker.getPosition());
        }
    }
});

function getObservatory(observatories, oid) {
    for (const observatory of observatories) {
        if (observatory['oid'] === oid) {
            return observatory;
        }
    }
    return null;
}

const observatories = await getObservatoryData();
observatories.forEach((observatory) => {
    // Create a marker for each observatory
    markers.add({
        id: observatory.oid,
        position: { lat: observatory.latitude, lng: observatory.longitude },
        color: 'green',
    })
});

getObservatory(observatories, 6);

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
let showPlots = false;
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
let showPanorama = false;
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