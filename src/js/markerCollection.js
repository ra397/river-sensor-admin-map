export class MarkerCollection {
    constructor(map) {
        this.map = map;
        this.markers = []; // { marker, properties }
        this.size = 2.5;
        this.color = "green";
        this.clickHandler = null;
    }

    #createIcon() {
        const s = this.size * 2;
        const svg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
            <circle cx="${this.size}" cy="${this.size}"
                    r="${this.size - 1}" fill="${this.color}" />
          </svg>
        `;

        return {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
            size: new google.maps.Size(s, s),
            anchor: new google.maps.Point(this.size, this.size),
        };
    }

    add(lat, lng, properties = {}) {
        const marker = new google.maps.Marker({
            position: { lat, lng },
            map: this.map,
            icon: this.#createIcon(),
        });

        const markerObj = {
            marker: marker,
            properties: properties,
            visible: true,
        };

        marker.addListener('click', () => {
            if (this.clickHandler) {
                this.clickHandler(markerObj);
            }
        });

        this.markers.push(markerObj);
        return markerObj;
    }

    onClick(handler) {
        this.clickHandler = handler;
    }

    setColor(color) {
        if (this.color === color) return;
        this.color = color;
        const newIcon = this.#createIcon();
        for (const markerObj of this.markers) {
            markerObj.marker.setIcon(newIcon);
        }
    }

    getColor() {
        return this.color;
    }

    setSize(size) {
        if (this.size === size) return;
        this.size = size;
        const newIcon = this.#createIcon();
        for (const markerObj of this.markers) {
            markerObj.marker.setIcon(newIcon);
        }
    }

    getSize() {
        return this.size;
    }

    hide() {
        for (const markerObj of this.markers) {
            markerObj.marker.setMap(null);
        }
    }

    show() {
        for (const markerObj of this.markers) {
            markerObj.marker.setMap(this.map);
        }
    }

    clear() {
        this.markers.forEach(markerObj => markerObj.marker.setMap(null));
        this.markers = [];
    }

    setFilter(filterFunc) {
        for (const markerObj of this.markers) {
            const visible = filterFunc(markerObj.properties);
            markerObj.visible = visible;
            markerObj.marker.setMap(visible ? this.map : null);
        }
    }
}