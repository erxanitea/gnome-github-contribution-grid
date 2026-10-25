<div align="center">

<img src="assets/logo.png" alt="GitHub Contribution Grid Logo" width="128" />

# GitHub Contribution Grid

A GNOME Shell extension that displays your GitHub contribution graph in the top panel and dropdown menu.

[![GNOME Shell](https://img.shields.io/badge/GNOME-45%20to%2051-4a86cf?style=flat-square&logo=gnome&logoColor=white)](https://extensions.gnome.org)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-4caf50?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Wayland%20%7C%20X11-orange?style=flat-square)](https://gitlab.gnome.org/GNOME/gnome-shell)
[![Version](https://img.shields.io/badge/Version-1.0.1-9c27b0?style=flat-square)](metadata.json)

</div>

---

## Previews

### Top Bar Indicator
A 7-day activity glance in the GNOME status bar.

<img src="assets/top-bar-preview.png" alt="Top Bar Preview" width="180" style="border-radius: 8px;" />

### Dropdown Menu
A full 53-week contribution calendar with streak statistics and controls.

<img src="assets/dropdown-preview.png" alt="Dropdown Menu Preview" width="600" style="border-radius: 14px;" />

---

## Features

- **Panel Indicator**: 7-day activity view on the status bar.
- **53-Week Heatmap**: Full-year calendar with tooltips for dates and commit counts.
- **Streak & Stats**: Tracks total contributions, peak day count, current streak, and longest streak.
- **10 Presets**: GitHub Classic, Emerald Green, Ocean Blue, Electric Purple, Sunset Orange, Cyberpunk Teal, Halloween Gold, Rose Pink, Amber Gold, and Monochrome Slate.
- **Custom Accent**: Custom hex color picker with automated multi-shade generation.
- **Offline Caching**: Cached local data on startup with background refresh.
- **Public & Private Profiles**: Supports public handles without credentials, plus optional personal access tokens for private activity.
- **Libadwaita Preferences**: Native GNOME settings interface.

---

## Color Themes

| Theme | Description | Range |
| :--- | :--- | :--- |
| **GitHub Classic** | GitHub dark mode palette | `#2d333b` → `#39d353` |
| **Emerald Green** | Forest green tones | `#2d333b` → `#34d399` |
| **Ocean Blue** | Azure blue shades | `#2d333b` → `#7dd3fc` |
| **Electric Purple** | Neon violet and lavender | `#2d333b` → `#c4b5fd` |
| **Sunset Orange** | Warm orange and amber | `#2d333b` → `#fb923c` |
| **Cyberpunk Teal** | High-contrast neon teal | `#2d333b` → `#48cae4` |
| **Halloween Gold** | Pumpkin spice and gold | `#2d333b` → `#fddf68` |
| **Rose Pink** | Rose and crimson gradient | `#2d333b` → `#fb7185` |
| **Amber Gold** | Vintage amber glow | `#2d333b` → `#fbbf24` |
| **Monochrome Slate** | Grayscale palette | `#2d333b` → `#cbd5e1` |
| **Custom Color** | User-selected hex color | Dynamic |

---

## Installation

### From GitHub Releases

1. Download `github-contribution-grid@erxanitea.shell-extension.zip` from [Releases](https://github.com/erxanitea/gnome-github-contribution-grid/releases).
2. Install the package:
   ```bash
   gnome-extensions install github-contribution-grid@erxanitea.shell-extension.zip --force
   ```

### From Source

Requires `git`, `make`, and `glib2.0` (`glib-compile-schemas`):

```bash
git clone https://github.com/erxanitea/gnome-github-contribution-grid.git
cd gnome-github-contribution-grid
make install
```

### Reload & Enable

**Wayland:** Log out and log back in, then enable:
```bash
gnome-extensions enable github-contribution-grid@erxanitea
```

**X11:** Press `Alt + F2`, type `r`, press `Enter`, then enable:
```bash
gnome-extensions enable github-contribution-grid@erxanitea
```

---

## Configuration

Open preferences from the dropdown menu or run:

```bash
gnome-extensions prefs github-contribution-grid@erxanitea
```

| Setting | Default | Description |
| :--- | :--- | :--- |
| **GitHub Username** | `""` | Target GitHub handle. |
| **Refresh Interval** | `60` min | Frequency in minutes between refreshes (5 to 1440 min). |
| **Color Theme** | `GitHub Classic` | Preset theme or custom color mode. |
| **Custom Accent Color** | `#39d353` | Hex code used when Custom Theme is selected. |
| **GitHub Token** | `""` | Optional token for private contributions and higher API limits. |

---

## Development

```bash
make
make pack
make clean
```

---

## License

This project is licensed under the [GNU General Public License v3.0 or later (GPL-3.0-or-later)](https://www.gnu.org/licenses/gpl-3.0.html).
