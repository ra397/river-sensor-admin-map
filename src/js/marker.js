class Marker {
    #id = null;
    #map = null;
    #marker = null;
    #color = null;
    #selected = false;
    #onClick = null;

    constructor(options = {}) {
        const { id, position, map, color, onClick } = options;

        this.#id = id;
        this.#map = map;
        this.#color = color;

        this.#marker = new google.maps.Marker({
            position,
            map,
            icon: this.#buildIcon(color, false),
            zIndex: 9999,
        });

        this.#onClick = this.#marker.addListener('click', (e) => {
            onClick?.(this, e);
        });
    }

    #buildIcon(color, selected) {
        const size = 8;
        const strokeColor = selected ? '#444' : '#000';
        const strokeWidth = selected ? 2 : 1;

        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${size * 3}" height="${size * 3}" viewBox="0 0 ${size * 3} ${size * 3}">
                <circle cx="${size * 1.5}" cy="${size * 1.5}" r="${size / 2}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
                ${selected ? `<circle cx="${size * 1.5}" cy="${size * 1.5}" r="${size}" fill="none" stroke="#444" stroke-width="2" opacity="0.6"/>` : ''}
            </svg>
        `;

        return {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
            anchor: new google.maps.Point(size * 1.5, size * 1.5),
            scaledSize: new google.maps.Size(size * 3, size * 3),
        };
    }

    #updateIcon() {
        this.#marker.setIcon(this.#buildIcon(this.#color, this.#selected));
    }

    getId() {
        return this.#id;
    }

    setPosition(position) { this.#marker.setPosition(position); }

    getPosition() { return this.#marker.getPosition(); }

    setZIndex(z) { this.#marker.setZIndex(z); }

    setSelected(selected) {
        this.#selected = selected;
        this.#updateIcon();
    }

    setColor(color) {
        this.#color = color;
        this.#updateIcon();
    }

    setVisible(visible) {
        this.#marker.setMap(visible ? this.#map : null);
    }

    destroy() {
        google.maps.event.removeListener(this.#onClick);
        this.#onClick = null;
        this.#marker.setMap(null);
        this.#marker = null;
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

    getSelected() {
        return this.#active;
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