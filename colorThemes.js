export const COLOR_THEMES = [
    {
        id: 'github',
        name: 'GitHub Classic',
        levels: ['#2d333b', '#0e4429', '#006d32', '#26a641', '#39d353'],
    },
    {
        id: 'emerald',
        name: 'Emerald Green',
        levels: ['#2d333b', '#064e3b', '#047857', '#10b981', '#34d399'],
    },
    {
        id: 'ocean',
        name: 'Ocean Blue',
        levels: ['#2d333b', '#0c4a6e', '#0284c7', '#38bdf8', '#7dd3fc'],
    },
    {
        id: 'purple',
        name: 'Electric Purple',
        levels: ['#2d333b', '#4c1d95', '#7c3aed', '#a78bfa', '#c4b5fd'],
    },
    {
        id: 'sunset',
        name: 'Sunset Orange',
        levels: ['#2d333b', '#7c2d12', '#c2410c', '#f97316', '#fb923c'],
    },
    {
        id: 'cyberpunk',
        name: 'Cyberpunk Teal',
        levels: ['#2d333b', '#044e54', '#08838e', '#00b4d8', '#48cae4'],
    },
    {
        id: 'halloween',
        name: 'Halloween Gold',
        levels: ['#2d333b', '#631c03', '#bd561d', '#fa7a18', '#fddf68'],
    },
    {
        id: 'rose',
        name: 'Rose Pink',
        levels: ['#2d333b', '#831843', '#be185d', '#f43f5e', '#fb7185'],
    },
    {
        id: 'amber',
        name: 'Amber Gold',
        levels: ['#2d333b', '#78350f', '#b45309', '#f59e0b', '#fbbf24'],
    },
    {
        id: 'monochrome',
        name: 'Monochrome Slate',
        levels: ['#2d333b', '#475569', '#64748b', '#94a3b8', '#cbd5e1'],
    },
    {
        id: 'custom',
        name: 'Custom Color',
        levels: null,
    },
];

export function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string')
        return [45, 51, 59];

    const clean = hex.replace('#', '').trim();
    if (clean.length === 3) {
        return [
            parseInt(clean[0] + clean[0], 16) || 0,
            parseInt(clean[1] + clean[1], 16) || 0,
            parseInt(clean[2] + clean[2], 16) || 0,
        ];
    }
    return [
        parseInt(clean.slice(0, 2), 16) || 0,
        parseInt(clean.slice(2, 4), 16) || 0,
        parseInt(clean.slice(4, 6), 16) || 0,
    ];
}

export function rgbToHex(r, g, b) {
    const clamp = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return `#${clamp(r)}${clamp(g)}${clamp(b)}`;
}

export function blendColors(hex1, hex2, ratio) {
    const [r1, g1, b1] = hexToRgb(hex1);
    const [r2, g2, b2] = hexToRgb(hex2);
    return rgbToHex(
        r1 * (1 - ratio) + r2 * ratio,
        g1 * (1 - ratio) + g2 * ratio,
        b1 * (1 - ratio) + b2 * ratio
    );
}

export function getPalette(themeId, customColor = '#39d353', customBgColor = '#2d333b') {
    const theme = COLOR_THEMES.find(t => t.id === themeId);
    if (theme && theme.levels)
        return theme.levels;

    const bg = customBgColor || '#2d333b';
    const fg = customColor || '#39d353';
    return [
        bg,
        blendColors(bg, fg, 0.25),
        blendColors(bg, fg, 0.50),
        blendColors(bg, fg, 0.75),
        fg,
    ];
}
