// Map style configurations and selector logic

const lightStyle = [{
    "featureType": "administrative",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#6b6b6b" }]
}, {
    "featureType": "landscape",
    "elementType": "all",
    "stylers": [{ "color": "#f2f2f2" }]
}, {
    "featureType": "poi",
    "elementType": "all",
    "stylers": [{ "visibility": "off" }]
}, {
    "featureType": "road",
    "elementType": "all",
    "stylers": [{ "saturation": -100 }, { "lightness": 45 }]
}, {
    "featureType": "road.highway",
    "elementType": "all",
    "stylers": [{ "visibility": "simplified" }]
}, {
    "featureType": "road.arterial",
    "elementType": "labels.icon",
    "stylers": [{ "visibility": "off" }]
}, {
    "featureType": "transit",
    "elementType": "all",
    "stylers": [{ "visibility": "off" }]
}, {
    "featureType": "water",
    "elementType": "all",
    "stylers": [{ "color": "#46bcec" }, { "visibility": "on" }]
}];

const darkStyle = [{
    "featureType": "all",
    "elementType": "geometry",
    "stylers": [{ "color": "#202c3e" }]
}, {
    "featureType": "all",
    "elementType": "labels.text.fill",
    "stylers": [{ "gamma": 0.01 }, { "lightness": 20 }, { "weight": "1.39" }, { "color": "#ffffff" }]
}, {
    "featureType": "all",
    "elementType": "labels.text.stroke",
    "stylers": [{ "weight": "0.96" }, { "saturation": "9" }, { "visibility": "on" }, { "color": "#000000" }]
}, {
    "featureType": "all",
    "elementType": "labels.icon",
    "stylers": [{ "visibility": "off" }]
}, {
    "featureType": "landscape",
    "elementType": "geometry",
    "stylers": [{ "lightness": 30 }, { "saturation": "9" }, { "color": "#29446b" }]
}, {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [{ "saturation": 20 }]
}, {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [{ "lightness": 20 }, { "saturation": -20 }]
}, {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{ "lightness": 10 }, { "saturation": -30 }]
}, {
    "featureType": "road",
    "elementType": "geometry.fill",
    "stylers": [{ "color": "#193a55" }]
}, {
    "featureType": "road",
    "elementType": "geometry.stroke",
    "stylers": [{ "saturation": 25 }, { "lightness": 25 }, { "weight": "0.01" }]
}, {
    "featureType": "water",
    "elementType": "all",
    "stylers": [{ "lightness": -20 }]
}];

const standardStyle = [{
    "featureType": "poi",
    "elementType": "all",
    "stylers": [{ "visibility": "off" }]
}, {
    "featureType": "transit",
    "elementType": "all",
    "stylers": [{ "visibility": "off" }]
}];

const mapStyles = {
    standard: standardStyle,
    light: lightStyle,
    dark: darkStyle,
};

export function initMapStyleControl(map) {
    const container = document.querySelector('.map-style-control');
    const toggle = container.querySelector('.map-style-toggle');
    const menu = container.querySelector('.map-style-menu');
    const options = container.querySelectorAll('.map-style-option');

    // Load saved style preference
    const savedStyle = localStorage.getItem('mapStyle') || 'standard';
    applyStyle(savedStyle);

    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('open');
    });

    options.forEach(option => {
        option.addEventListener('click', () => {
            const style = option.dataset.style;
            applyStyle(style);
            localStorage.setItem('mapStyle', style);
            menu.classList.remove('open');

            // Update active state
            options.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            menu.classList.remove('open');
        }
    });

    // Set initial active state
    const activeOption = container.querySelector(`[data-style="${savedStyle}"]`);
    if (activeOption) activeOption.classList.add('active');

    function applyStyle(styleName) {
        if (styleName === 'satellite') {
            map.setMapTypeId('hybrid');
        } else {
            map.setMapTypeId('roadmap');
            map.setOptions({ styles: mapStyles[styleName] || [] });
        }
    }
}
