import Plotly from 'plotly.js-dist-min';

const PLOT_ID = 'usgs-gauge';

export function showGaugePlot(gauge, points, unit, maxY) {
    const div = resetPlotArea();
    if (!div) return;

    div.id = PLOT_ID;

    // Plotly measures the div as it plots, so the panel is on screen before it does;
    // measuring a hidden panel gives it no size and it falls back to its own 700x450.
    show();

    const trace = {
        x: points.map(p => p.x),
        y: points.map(p => p.y),
        type: 'scattergl',
        mode: 'markers',
        name: 'Gage height',
        line: { color: 'blue' }
    };

    const layout = {
        // The taller top margin is what the two-line title needs.
        margin: { l: 45, r: 25, b: 25, t: 50, pad: 4 },
        title: buildTitle(gauge),
        xaxis: {
            title: 'Date',
            showline: true,
            linecolor: 'black'
        },
        yaxis: {
            title: unit ? `Gage height (${unit})` : 'Gage height',
            // An explicit range keeps every gauge readable against its own scale.
            ...(Number.isFinite(maxY) && maxY > 0 ? { range: [0, maxY] } : { autorange: true }),
            showline: true,
            linecolor: 'black',
            tickformat: '.4r'
        }
    };

    Plotly.newPlot(div, [trace], layout, {
        displayModeBar: false,
        responsive: true
    });
}

// The name is what a reader recognizes, the site id is what they cite, so the plot carries both.
function buildTitle(gauge) {
    const siteName = gauge.siteName ?? '';
    const id = gauge.id ?? '';
    const shortName = siteName.length > 30 ? `${siteName.slice(0, 30)}...` : siteName;

    // The caller falls back to the id when USGS has no name, so never print it twice.
    if (!id || id === siteName) return { text: siteName || id };

    const url = `https://waterdata.usgs.gov/monitoring-location/${id}/#dataTypeId=continuous-00065-0&period=P30D&showFieldMeasurements=true`

    return {
        text: `${shortName} <a href='${url}' target='_blank'><span class="link">${id}</span></a>`,
        font: { size: 14 }
    };
}

export function showGaugeLoading() {
    const div = resetPlotArea();
    if (!div) return;

    div.classList.add('gauge-loading');
    div.innerHTML = '<div class="gauge-spinner" role="status" aria-label="Loading gauge data"></div>';
    show();
}

export function showGaugeMessage(text) {
    const div = resetPlotArea();
    if (!div) return;

    div.textContent = text;
    show();
}

export function clearGaugePlot() {
    purge();

    const body = document.querySelector('#usgs-plot-container .plotly-body');
    if (body) body.innerHTML = '';

    hide();
}

function getContainer() {
    return document.querySelector('#usgs-plot-container');
}

// #usgs-plot-container ships empty on this page, so the panel contents are built once, on demand
function getBody(container) {
    let body = container.querySelector('.plotly-body');
    if (body) return body;

    const close = document.createElement('span');
    close.className = 'usgs-close-button';
    close.textContent = '✕';
    close.setAttribute('aria-label', 'Close chart');
    close.addEventListener('click', clearGaugePlot);
    container.appendChild(close);

    body = document.createElement('div');
    body.className = 'plotly-body';
    container.appendChild(body);

    return body;
}

function resetPlotArea() {
    const container = getContainer();
    if (!container) return null;

    const body = getBody(container);

    purge();
    body.innerHTML = '';

    const div = document.createElement('div');
    div.className = 'plot';
    body.appendChild(div);

    return div;
}

function show() {
    getContainer()?.classList.remove('hidden');
}

function hide() {
    getContainer()?.classList.add('hidden');
}

function purge() {
    const existing = document.getElementById(PLOT_ID);
    if (existing) Plotly.purge(existing);
}