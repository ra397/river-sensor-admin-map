export class ColorBar {
    constructor(container, colors = null, ticks = null, title = null) {
        this.container = container;
        this.element = document.createElement('div');
        this.element.className = 'colorbar';
        this.container.appendChild(this.element);
        if (colors !== null && ticks !== null) {
            this.update(colors, ticks, title);
        }
    }

    update(colors, ticks, title) {
        if (ticks.length !== colors.length + 1) {
            throw new Error('ticks must have length colors.length + 1');
        }
        this.colors = colors;
        this.ticks = ticks;
        if (title !== undefined) this.title = title;
        this._render();
    }

    _render() {
        this.element.innerHTML = '';

        const titleEl = document.createElement('div');
        titleEl.className = 'colorbar-title';
        titleEl.textContent = this.title;
        this.element.appendChild(titleEl);

        const body = document.createElement('div');
        body.className = 'colorbar-body';

        const swatches = document.createElement('div');
        swatches.className = 'colorbar-swatches';
        for (const color of this.colors) {
            const swatch = document.createElement('div');
            swatch.className = 'colorbar-swatch';
            swatch.style.background = color;
            swatches.appendChild(swatch);
        }

        const labels = document.createElement('div');
        labels.className = 'colorbar-labels';
        for (const tick of this.ticks) {
            const label = document.createElement('div');
            label.className = 'colorbar-label';
            label.textContent = tick;
            labels.appendChild(label);
        }

        body.appendChild(swatches);
        body.appendChild(labels);
        this.element.appendChild(body);
    }

    show() {
        this.container.style.display = '';
        this.element.style.display = '';
    }

    hide() {
        this.element.style.display = 'none';
    }

    setTitle(title) {
        this.title = title;
        this._render();
    }
}