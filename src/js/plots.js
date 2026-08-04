import Plotly from 'plotly.js-dist-min';
import { getBatteryReportData, getReportData, getNotifications } from './api.js';
import { isAuthenticated } from './auth.js';

const plotlyContainerEl = document.querySelector('#plot-container');

const THRESHOLD_LINE_COLOR = '#7f8c8d';
const THRESHOLD_HIGHLIGHT_COLOR = '#e67e22';

let currentObservatoryId = null;
let activePlot = 'packet-count'; // default

let thresholds = [];              // this user's notification thresholds for the site
let highlightedThresholdId = null; // the registration open in the notifications panel
let pickingArmed = false;          // true while the notifications panel is open

export function showPlotly() {
    plotlyContainerEl.classList.remove('hidden');
}

function hidePlotly() {
    plotlyContainerEl.classList.add('hidden');
}

function getDateRange(yearsBack = 1, extraDaysEnd = 0) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + extraDaysEnd);
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - yearsBack);

    const format = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    };

    return { startDate: format(startDate), endDate: format(endDate) };
}

const PLOT_CONFIG = {
    'packet-count': {
        title: 'Packet Count',
        yaxis: 'Count',
        traces: [
            { key: 'pkt_cnt', xKey: 'dt', name: 'Packet Count', mode: 'markers', type: 'scattergl', color: 'blue' }
        ],
    },
    'battery': {
        title: 'Battery',
        yaxis: 'Voltage (V)',
        traces: [
            { key: 'avg', xKey: 'dt', name: 'Average', mode: 'lines+markers', type: 'scattergl', color: 'blue' },
            { key: 'max', xKey: 'dt', name: 'Max', mode: 'lines+markers', type: 'scattergl', color: 'green' },
            { key: 'min', xKey: 'dt', name: 'Min', mode: 'lines+markers', type: 'scattergl', color: 'red' }
        ],
        yearsApi: true,
        yearsBack: 3,
        plotYearsBack: 1,
    },
    'measurements': {
        title: 'Measurements',
        yaxis: 'Value (cm)',
        traces: [
            { key: 'primary', xKey: 'validtime', name: 'Primary', mode: 'markers', type: 'scattergl', color: 'blue', flagKey: 'flag' }
        ],
        yTickFormat: 'd',
        showThresholds: true, // measurements share the notification threshold units (cm)
    },
    'moisture': {
        title: 'Moisture',
        yaxis: 'Moisture (%)',
        traces: [
            { key: 'avg', xKey: 'dt', name: 'Average', mode: 'lines+markers', type: 'scattergl', color: 'blue' },
            { key: 'max', xKey: 'dt', name: 'Max', mode: 'lines+markers', type: 'scattergl', color: 'green' },
            { key: 'min', xKey: 'dt', name: 'Min', mode: 'lines+markers', type: 'scattergl', color: 'red' }
        ],
    }
};

async function renderActivePlot() {
    if (!currentObservatoryId) return;

    const container = document.querySelector('.plotly-body');
    container.innerHTML = '';

    const div = document.createElement('div');
    div.className = 'plot';
    div.id = activePlot;
    container.appendChild(div);

    const config = PLOT_CONFIG[activePlot];
    const yearsBack = config.yearsBack ?? 1;
    const plotYearsBack = config.plotYearsBack ?? yearsBack;
    const { startDate, endDate } = getDateRange(yearsBack);
    const plotRangeDates = getDateRange(plotYearsBack, 7);

    const data = config.yearsApi
        ? await getBatteryReportData(currentObservatoryId, yearsBack)
        : await getReportData(activePlot, currentObservatoryId, startDate, endDate);

    await Plotly.newPlot(activePlot, buildTraces(config, data), buildLayout(config, [toDateStr(plotRangeDates.startDate), toDateStr(plotRangeDates.endDate)]), {
        displayModeBar: false,
        responsive: true,
    });

    attachThresholdPicker(div);
}

function buildPlotlyToggles() {
    const container = document.querySelector('#plot-container .toggle-container');

    for (const [variable, config] of Object.entries(PLOT_CONFIG)) {
        const toggleItem = document.createElement('span');
        toggleItem.className = 'toggle-item';
        toggleItem.dataset.plot = variable;
        toggleItem.textContent = config.title;

        if (variable === activePlot) toggleItem.classList.add('active');

        toggleItem.addEventListener('click', async () => {
            if (activePlot === variable) return; // already active

            activePlot = variable;

            // update active class
            container.querySelectorAll('.toggle-item').forEach(el => {
                el.classList.toggle('active', el.dataset.plot === variable);
            });

            await renderActivePlot();
        });

        container.appendChild(toggleItem);
    }
}

function buildTraces(config, data) {
    return config.traces.map(t => {
        const trace = {
            x: data.map(d => d[t.xKey]),
            y: data.map(d => d[t.key]),
            type: 'scatter',
            mode: t.mode,
            name: t.name,
            line: { color: t.color, ...(t.dash && { dash: t.dash }) }
        };

        if (t.flagKey) {
            trace.marker = {
                color: data.map(d => d[t.flagKey] === false ? 'red' : 'blue')
            };
        }

        return trace;
    });
}

function buildShapes(config) {
    const now = new Date();
    const shapes = [{
        type: 'line',
        x0: now, x1: now,
        y0: 0, y1: 1,
        yref: 'paper',
        line: { color: 'red', width: 2 }
    }];

    if (!config.showThresholds) return shapes;

    thresholds.forEach(threshold => {
        const highlighted = threshold.notification_id === highlightedThresholdId;
        shapes.push({
            type: 'line',
            x0: 0, x1: 1,
            xref: 'paper',
            y0: Number(threshold.threshold), y1: Number(threshold.threshold),
            line: {
                color: highlighted ? THRESHOLD_HIGHLIGHT_COLOR : THRESHOLD_LINE_COLOR,
                width: highlighted ? 3 : 1.5,
                dash: highlighted ? 'solid' : 'dash',
            }
        });
    });

    return shapes;
}

function buildAnnotations(config) {
    if (!config.showThresholds) return [];

    return thresholds.map(threshold => {
        const highlighted = threshold.notification_id === highlightedThresholdId;
        return {
            x: 1, xref: 'paper', xanchor: 'right',
            y: Number(threshold.threshold), yref: 'y', yanchor: 'bottom',
            text: `${Number(threshold.threshold).toFixed(2)} cm`,
            showarrow: false,
            font: {
                size: 9,
                color: highlighted ? 'white' : THRESHOLD_LINE_COLOR,
            },
            bgcolor: highlighted ? THRESHOLD_HIGHLIGHT_COLOR : 'rgba(255, 255, 255, 0.7)',
            borderpad: 2,
        };
    });
}

function buildLayout(config, range) {
    return {
        margin: { l: 45, r: 25, b: 25, t: 25, pad: 4 },
        shapes: buildShapes(config),
        annotations: buildAnnotations(config),
        title: config.title,
        xaxis: {
            title: 'Date',
            showline: true,
            linecolor: 'black',
            range: range,
            autorange: false,
        },
        yaxis: {
            title: config.yaxis,
            showline: true,
            linecolor: 'black',
            tickformat: config.yTickFormat,
        },
        legend: {
            x: 0.01, y: 0.99,
            xanchor: 'left', yanchor: 'top'
        }
    };
}

async function loadThresholds() {
    if (!currentObservatoryId || !isAuthenticated()) {
        thresholds = [];
        return;
    }

    try {
        const registrations = await getNotifications();
        thresholds = registrations.filter(r => r.oid === currentObservatoryId);
    } catch (err) {
        // The plot stays usable without the threshold lines
        console.error(err);
        thresholds = [];
    }
}

// Redraws the threshold lines in place, without refetching the report data
function redrawThresholds() {
    const config = PLOT_CONFIG[activePlot];
    const gd = document.getElementById(activePlot);
    if (!gd?.data || !config) return;

    Plotly.relayout(gd, {
        shapes: buildShapes(config),
        annotations: buildAnnotations(config),
    });
}

// Plotly only reports clicks that land on a data point, so convert the click
// position through the y-axis to support picking anywhere in the plot area
function clickToYValue(gd, event) {
    const yaxis = gd._fullLayout?.yaxis;
    if (typeof yaxis?.p2d !== 'function') return null;

    const offsetY = event.clientY - gd.getBoundingClientRect().top - yaxis._offset;
    if (offsetY < 0 || offsetY > yaxis._length) return null;

    const value = yaxis.p2d(offsetY);
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function attachThresholdPicker(gd) {
    let pressedAt = null;

    gd.addEventListener('pointerdown', (event) => {
        pressedAt = { x: event.clientX, y: event.clientY };
    });

    gd.addEventListener('click', (event) => {
        if (!pickingArmed || !PLOT_CONFIG[activePlot]?.showThresholds) return;

        // A drag is a zoom, not a pick
        const travel = pressedAt
            ? Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y)
            : 0;
        if (travel > 4) return;

        const y = clickToYValue(gd, event);
        if (y === null) return;

        window.dispatchEvent(new CustomEvent('plot:click', {
            detail: { variable: activePlot, observatoryId: currentObservatoryId, y }
        }));
    });
}

export async function updateReports(observatoryId) {
    currentObservatoryId = observatoryId;
    await loadThresholds();
    await renderActivePlot();
    showPlotly();
}

function toDateStr(n) {
    const s = String(n);
    return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
}

// The notifications panel arms threshold picking and tells us which
// registration it is editing so that line can be highlighted
window.addEventListener('notifications:panel', async (e) => {
    const { open, editingId = null } = e.detail;
    const opening = open && !pickingArmed;

    pickingArmed = open;
    highlightedThresholdId = open ? editingId : null;

    // Opening the panel implies a login, so the thresholds may only be readable now
    if (opening) await loadThresholds();
    redrawThresholds();
});

window.addEventListener('update:notifications', async () => {
    await loadThresholds();
    redrawThresholds();
});

buildPlotlyToggles();
hidePlotly();

plotlyContainerEl.querySelector('.close-button').addEventListener('click', () => {
    plotlyContainerEl.classList.add('hidden');
})