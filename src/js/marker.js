export class Markers {
    #data;
    #markers = new Map();     // id -> { id, lat, lng }
    #features = new Map();    // id -> google.maps.Data.Feature
    #handlers = new Map();    // id -> click handler
    #hidden = new Set();      // hidden ids
    #selectedId = null;
    #icon;
    #selectedIcon;
    #onClick;

    constructor(map, options = {}) {
        if (!options.style || !options.selectedStyle) {
            throw new Error("Markers requires a style and a selectedStyle SVG string");
        }

        this.#onClick = options.onClick || null;
        this.#icon = this.#toIcon(options.style);
        this.#selectedIcon = this.#toIcon(options.selectedStyle);

        this.#data = new google.maps.Data({ map });

        // One listener for the whole collection.
        this.#data.addListener("click", event => {
            const marker = this.#markers.get(event.feature.getProperty("id"));
            if (!marker) return;

            const handler = this.#handlers.get(marker.id) || this.#onClick;
            if (handler) handler(marker);
        });

        this.#restyle();
    }

    add(markerOrMarkers, onClick) {
        const list = Array.isArray(markerOrMarkers) ? markerOrMarkers : [markerOrMarkers];

        const incoming = new Set();
        for (const { id } of list) {
            if (this.#markers.has(id) || incoming.has(id)) {
                throw new Error(`Marker with id "${id}" already exists`);
            }
            incoming.add(id);
        }

        // One bulk insertion, regardless of how many markers.
        const features = this.#data.addGeoJson({
            type: "FeatureCollection",
            features: list.map(({ id, lat, lng }) => ({
                type: "Feature",
                geometry: { type: "Point", coordinates: [lng, lat] },
                properties: { id }
            }))
        });

        for (const { id, lat, lng } of list) {
            this.#markers.set(id, { id, lat, lng });
            if (onClick) this.#handlers.set(id, onClick);
        }

        for (const feature of features) {
            this.#features.set(feature.getProperty("id"), feature);
        }
    }

    get(id) {
        return this.#markers.get(id) || null;
    }

    select(markerOrId) {
        const id = this.#toId(markerOrId);
        if (id !== null && !this.#markers.has(id)) return;

        this.#selectedId = id ?? null;
        this.#restyle();
    }

    getSelected() {
        return this.#selectedId === null ? null : this.#markers.get(this.#selectedId);
    }

    remove(markerOrId) {
        const id = this.#toId(markerOrId);
        const feature = this.#features.get(id);
        if (!feature) return;

        this.#data.remove(feature);
        this.#features.delete(id);
        this.#markers.delete(id);
        this.#handlers.delete(id);
        this.#hidden.delete(id);
        if (this.#selectedId === id) this.#selectedId = null;

        this.#restyle();
    }

    setMarkerStyle(markerOrId, svg) {
        const id = this.#toId(markerOrId);
        const marker = this.#markers.get(id);

        if (!marker) return;

        marker.icon = this.#toIcon(svg);
        this.#restyle();
    }

    show(markerOrId) {
        this.#hidden.delete(this.#toId(markerOrId));
        this.#restyle();
    }

    hide(markerOrId) {
        const id = this.#toId(markerOrId);
        if (this.#markers.has(id)) this.#hidden.add(id);
        this.#restyle();
    }

    showAll() {
        this.#hidden.clear();
        this.#restyle();
    }

    hideAll() {
        for (const id of this.#markers.keys()) this.#hidden.add(id);
        this.#restyle();
    }

    setStyle(svg) {
        this.#icon = this.#toIcon(svg);

        for (const marker of this.#markers.values()) {
            marker.icon = null;
        }

        this.#restyle();
    }

    setSelectedStyle(svg) {
        this.#selectedIcon = this.#toIcon(svg);
        this.#restyle();
    }

    // Re-applying the style function makes the Data Layer re-evaluate every
    // feature against the current state (hidden / selected / icons).
    #restyle() {
        this.#data.setStyle(feature => {
            const id = feature.getProperty("id");

            if (this.#hidden.has(id)) {
                return { visible: false };
            }

            if (id === this.#selectedId) {
                return { icon: this.#selectedIcon };
            }

            const marker = this.#markers.get(id);

            return {
                icon: marker?.icon ?? this.#icon
            };
        });
    }

    #toIcon(svg) {
        const url = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
        const width = parseFloat(/width="([\d.]+)"/.exec(svg)?.[1]);
        const height = parseFloat(/height="([\d.]+)"/.exec(svg)?.[1]);

        return width && height
            ? { url, anchor: new google.maps.Point(width / 2, height / 2) }
            : { url };
    }

    #toId(markerOrId) {
        return markerOrId && typeof markerOrId === "object" ? markerOrId.id : markerOrId;
    }
}