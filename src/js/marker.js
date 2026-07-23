const PULSE_PERIOD = 1300; // ms per ripple
const PULSE_FPS    = 30;   // throttle: re-encoding the SVG is not free

class Marker {
    #id = null;
    #map = null;
    #marker = null;
    #color = null;
    #selected = false;
    #onClick = null;

    #rafId = null;
    #pulseStart = 0;
    #lastDraw = 0;

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

    // t = ripple progress 0..1, only used when selected
    #buildIcon(color, selected, t = 0) {
        const size   = 8;
        const dotR   = size / 2;
        // canvas grows when selected so the expanding ring isn't clipped
        const canvas = selected ? size * 4 : size * 2;
        const c      = canvas / 2;

        const strokeColor = selected ? '#444' : '#000';
        const strokeWidth = selected ? 2 : 1;

        let ripple = '';
        if (selected) {
            const maxR    = canvas / 2 - 2;
            const eased   = 1 - Math.pow(1 - t, 2);      // fast out, slow finish
            const r       = dotR + (maxR - dotR) * eased;
            const opacity = (1 - t) * 0.6;
            ripple = `<circle cx="${c}" cy="${c}" r="${r.toFixed(2)}" fill="none"
                              stroke="#444" stroke-width="2" opacity="${opacity.toFixed(3)}"/>`;
        }

        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}" viewBox="0 0 ${canvas} ${canvas}">
                ${ripple}
                <circle cx="${c}" cy="${c}" r="${dotR}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
            </svg>
        `;

        return {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
            anchor: new google.maps.Point(c, c),
            scaledSize: new google.maps.Size(canvas, canvas),
        };
    }

    #updateIcon(t = 0) {
        this.#marker?.setIcon(this.#buildIcon(this.#color, this.#selected, t));
    }

    #startPulse() {
        if (this.#rafId !== null) return;
        this.#pulseStart = performance.now();
        this.#lastDraw = 0;

        const step = (now) => {
            if (!this.#marker || !this.#selected) return;

            if (now - this.#lastDraw >= 1000 / PULSE_FPS) {
                this.#lastDraw = now;
                const t = ((now - this.#pulseStart) % PULSE_PERIOD) / PULSE_PERIOD;
                this.#updateIcon(t);
            }
            this.#rafId = requestAnimationFrame(step);
        };

        this.#rafId = requestAnimationFrame(step);
    }

    #stopPulse() {
        if (this.#rafId === null) return;
        cancelAnimationFrame(this.#rafId);
        this.#rafId = null;
    }

    getId() { return this.#id; }

    setPosition(position) { this.#marker.setPosition(position); }

    getPosition() { return this.#marker.getPosition(); }

    setZIndex(z) { this.#marker.setZIndex(z); }

    setSelected(selected) {
        if (this.#selected === selected) return;
        this.#selected = selected;

        if (selected) {
            this.#startPulse();
        } else {
            this.#stopPulse();
            this.#updateIcon();
        }
    }

    setColor(color) {
        this.#color = color;
        if (!this.#selected) this.#updateIcon();
    }

    setVisible(visible) {
        this.#marker.setMap(visible ? this.#map : null);
        if (!visible) this.#stopPulse();
        else if (this.#selected) this.#startPulse();
    }

    destroy() {
        this.#stopPulse();
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

    getBoundingBox() {
        const bounds = new google.maps.LatLngBounds();
        this.#markers.forEach(m => bounds.extend(m.getPosition()));
        return bounds;
    }
}