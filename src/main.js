import { map } from './js/map.js';
import { Markers } from "./js/marker.js";
import { getObservatoryData } from "./js/api.js";
import { initSearch } from "./js/search.js";
import { initFilters } from "./js/filter.js";
import { colorByConfig, getColor } from "./js/colorByUI.js";
import { ColorBar } from "./js/ColorBar.js";

const markers = new Markers({
    map: map,
    onClick: (marker) => {
        markers.select(marker);
    }
})

const observatories = await getObservatoryData();
observatories.forEach((observatory) => {
    // Create a marker for each observatory
    markers.add({
        id: observatory.oid,
        position: { lat: observatory.latitude, lng: observatory.longitude },
        color: 'green',
    })
});

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

initSearch(markers, map, observatories);
initFilters(markers, observatories);