import { map } from './js/map.js';
import { Markers } from "./js/marker.js";
import { getObservatoryData } from "./js/api.js";
import { initSearch } from "./js/search.js";
import {initFilters} from "./js/filter.js";

const markers = new Markers({
    map: map,
    onClick: (marker) => {
        markers.select(marker);
    }
})

const observatories = await getObservatoryData();
console.log(observatories);
observatories.forEach((observatory) => {
    // Create a marker for each observatory
    markers.add({
        id: observatory.oid,
        position: { lat: observatory.latitude, lng: observatory.longitude },
        color: 'green',
    })
});

initSearch(markers, map, observatories);
initFilters(markers, observatories);