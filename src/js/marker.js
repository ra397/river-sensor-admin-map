class Marker {
    #id = null;
    #map = null;
    #marker = null;
    #markerEl= null;
    #onClick = null;

    constructor(options = {}) {
        const { id, position, map, color, onClick } = options;

        this.#id = id;
        this.#map = map;

        this.#markerEl = this.#buildElement(color);

        this.#marker = new google.maps.marker.AdvancedMarkerElement({
            position,
            map,
            content: this.#markerEl,
            zIndex: 9999,
        });

        this.#onClick = this.#marker.addListener('gmp-click', (e) => {
            onClick?.(this, e);
        });
    }

    #buildElement(color) {
        const el = document.createElement('div');
        el.className = 'map-marker';
        el.style.setProperty('--marker-color', color);
        return el;
    }

    getId() {
        return this.#id;
    }

    setPosition(position) { this.#marker.position = position; }

    getPosition() { return this.#marker.position; }

    setZIndex(z) { this.#marker.zIndex = z; }

    setSelected(selected) {
        this.#markerEl.classList.toggle('selected', selected);
    }

    setColor(color) {
        this.#markerEl.style.setProperty('--marker-color', color);
    }

    setVisible(visible) {
        this.#marker.map = visible ? this.#map : null;
    }

    destroy() {
        this.#onClick?.remove();
        this.#onClick = null;
        this.#marker.map = null;
        this.#marker = null;
        this.#markerEl.remove();
        this.#markerEl = null;
    }
}

export class Markers {
    #markers = [];
    #map = null;
    #onClick = null;
    #active = null;

    constructor(options = {}) {
        const { map, onClick } = options;
        this.#map = map;
        this.#onClick = onClick;
    }

    add(options = {}) {
        const marker = new Marker({
            ...options,
            map: this.#map,
            onClick: this.#onClick,
        });
        this.#markers.push(marker);
        return marker;
    }

    get(id) {
        return this.#markers.find(m => m.getId() === id);
    }

    select(marker) {
        if (this.#active === marker) return;
        this.#active?.setSelected(false);
        this.#active = marker;
        marker?.setSelected(true);

        marker?.setVisible(true);
    }

    remove(marker) {
        const idx = this.#markers.indexOf(marker);
        if (idx === -1) return;
        marker.destroy();
        this.#markers.splice(idx, 1);
    }

    forEach(callback) {
        this.#markers.forEach(callback);
    }

    removeAll() {
        for (const m of this.#markers) m.destroy();
        this.#markers = [];
    }
}