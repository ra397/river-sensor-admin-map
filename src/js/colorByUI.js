const container = document.querySelector('.color-control');
const checkboxes = container.querySelectorAll('input[type="checkbox"]');

checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
        if (cb.checked) {
            checkboxes.forEach(other => {
                if (other !== cb) other.checked = false;
            });
        }

        const active = Array.from(checkboxes).find(c => c.checked);
        const colorBy = active?.dataset.colorby ?? null;

        window.dispatchEvent(new CustomEvent('colorby:change', {
            detail: { colorBy },
        }));
    });
});

export const colorByConfig = {
    voltage: {
        title: 'Voltage',
        colors: ['#00aa22', '#577018', '#725e15', '#b5320d', '#fe0104'],
        ticks: ['', '10', '11', '12', '13', ''].reverse()
    },
    // firmware_version: {
    //     title: 'Firmware',
    //     colors: ['#047857', '#059669', '#10B981', '#34D399', '#6EE7B7', '#1E3A8A', '#2563EB', '#3B82F6'].reverse(),
    //     ticks: ['0.6', '0.86', '0.88', '0.89', '0.9', '1.00', '1.01', '6.1', ''].reverse(),
    // },
    no_packet_days: {
        title: 'Packets',
        colors: ['#00FF00', '#FF9F1C', '#FF0000'].reverse(),
        ticks: ['', '7', '14', ''].reverse()
    },
}

export function getColor(value, config) {
    if (value == null) return '#cccccc';
    const n = Number(value);
    if (Number.isNaN(n)) return '#cccccc';

    // Reverse back to ascending order: colors[i] applies between ticks[i] and ticks[i+1]
    const colors = [...config.colors].reverse();
    const ticks = [...config.ticks].reverse();

    for (let i = 0; i < colors.length; i++) {
        const lower = ticks[i] === '' || ticks[i] === undefined
            ? -Infinity
            : Number(ticks[i]);
        const upper = ticks[i + 1] === '' || ticks[i + 1] === undefined
            ? Infinity
            : Number(ticks[i + 1]);
        if (n >= lower && n < upper) return colors[i];
    }
    return '#cccccc';
}