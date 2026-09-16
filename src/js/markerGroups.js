const groups = [];

export function registerMarkerGroup(markers, panels = []) {
    const group = { markers, panels };
    groups.push(group);
    return group;
}

// Resets every other collection and hides its panels.
export function activateMarkerGroup(markers) {
    for (const group of groups) {
        if (group.markers === markers) continue;

        group.markers?.reset();
        for (const panel of group.panels) panel?.classList.add('hidden');
    }
}