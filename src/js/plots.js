import Plotly from 'plotly.js-dist-min';
import { getReportData } from './api.js';

const plotlyContainerEl = document.querySelector('#plot-container');

let currentObservatoryId = null;
let activePlot = 'packet-count'; // default

export function showPlotly() {
    plotlyContainerEl.classList.remove('hidden');
}

function hidePlotly() {
    plotlyContainerEl.classList.add('hidden');
}

function getDateRange() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);

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
            { key: 'pkt_cnt', xKey: 'dt', name: 'Packet Count', mode: 'markers', color: 'blue' }
        ],
    },
    'battery': {
        title: 'Battery',
        yaxis: 'Voltage (V)',
        traces: [
            { key: 'avg', xKey: 'dt', name: 'Average', mode: 'lines+markers', color: 'blue' },
            { key: 'max', xKey: 'dt', name: 'Max', mode: 'lines+markers', color: 'green' },
            { key: 'min', xKey: 'dt', name: 'Min', mode: 'lines+markers', color: 'red' }
        ],
    },
    'measurements': {
        title: 'Measurements',
        yaxis: 'Value',
        traces: [
            { key: 'primary', xKey: 'validtime', name: 'Primary', mode: 'markers', color: 'blue' }
        ],
    },
    'moisture': {
        title: 'Moisture',
        yaxis: 'Moisture (%)',
        traces: [
            { key: 'avg', xKey: 'dt', name: 'Average', mode: 'lines+markers', color: 'blue' },
            { key: 'max', xKey: 'dt', name: 'Max', mode: 'lines+markers', color: 'green' },
            { key: 'min', xKey: 'dt', name: 'Min', mode: 'lines+markers', color: 'red' }
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
    const { startDate, endDate } = getDateRange();
    const data = await getReportData(activePlot, currentObservatoryId, startDate, endDate);

    Plotly.newPlot(activePlot, buildTraces(config, data), buildLayout(config, [toDateStr(startDate), toDateStr(endDate)]), {
        displayModeBar: false,
        responsive: true,
    });
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
    return config.traces.map(t => ({
        x: data.map(d => d[t.xKey]),
        y: data.map(d => d[t.key]),
        type: 'scatter',
        mode: t.mode,
        name: t.name,
        line: { color: t.color, ...(t.dash && { dash: t.dash }) }
    }));
}

function buildLayout(config, range) {
    const now = new Date();
    return {
        margin: { l: 35, r: 25, b: 25, t: 25, pad: 4 },
        shapes: [{
            type: 'line',
            x0: now, x1: now,
            y0: 0, y1: 1,
            yref: 'paper',
            line: { color: 'red', width: 2 }
        }],
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
        },
        legend: {
            x: 0.01, y: 0.99,
            xanchor: 'left', yanchor: 'top'
        }
    };
}

export async function updateReports(observatoryId) {
    currentObservatoryId = observatoryId;
    await renderActivePlot();
    showPlotly();
}

function toDateStr(n) {
    const s = String(n);
    return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
}

buildPlotlyToggles();
hidePlotly();