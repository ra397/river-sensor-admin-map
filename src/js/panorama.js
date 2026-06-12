const { StreetViewService } = await google.maps.importLibrary('streetView');

const panoContainer = document.getElementById('pano-container');
const panoDiv = document.getElementById('pano');
let panorama = null;
const svService = new StreetViewService();

export async function showStreetView(latLng) {
    // Find the nearest pano within 50m
    await svService.getPanorama({location: latLng, radius: 50}, (data, status) => {
        if (status !== 'OK') {
            console.warn('No Street View available here');
            return;
        }

        if (!panorama) {
            panorama = new google.maps.StreetViewPanorama(panoDiv, {
                pano: data.location.pano,
                pov: {heading: 0, pitch: 0},
                zoom: 1,
                addressControl: true,
                fullscreenControl: false,
                motionTracking: false,
                motionTrackingControl: false,
            });
        } else {
            panorama.setPano(data.location.pano);
        }

        panoContainer.classList.remove('hidden');
    });
}

panoContainer.querySelector('.close-button').addEventListener('click', () => {
    panoContainer.classList.add('hidden');
});