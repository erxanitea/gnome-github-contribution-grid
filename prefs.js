import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {COLOR_THEMES, getPalette, hexToRgb} from './colorThemes.js';

export default class GithubGridPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window._settings = this.getSettings();
        const settings = window._settings;

        const page = new Adw.PreferencesPage({
            title: _('Github Contribution Grid'),
            icon_name: 'applications-development-symbolic',
        });

        const generalGroup = new Adw.PreferencesGroup({
            title: _('General'),
            description: _('Configure the GitHub account and refresh behavior.'),
        });

        const usernameRow = new Adw.EntryRow({
            title: _('GitHub Username'),
            tooltip_text: _('Enter the GitHub username whose public contribution activity should be displayed.'),
        });
        settings.bind('username', usernameRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        generalGroup.add(usernameRow);

        const refreshRow = new Adw.SpinRow({
            title: _('Refresh Interval'),
            subtitle: _('Minutes between background refreshes'),
            tooltip_text: _('How frequently the extension queries GitHub in the background (5 to 1440 minutes).'),
            adjustment: new Gtk.Adjustment({
                lower: 5,
                upper: 1440,
                step_increment: 5,
                page_increment: 30,
                value: 60,
            }),
        });
        settings.bind('refresh-interval-minutes', refreshRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        generalGroup.add(refreshRow);

        const colorGroup = new Adw.PreferencesGroup({
            title: _('Appearance'),
            description: _('Customize the contribution grid colors and appearance.'),
        });

        const stringList = new Gtk.StringList();
        COLOR_THEMES.forEach(t => stringList.append(t.name));

        const currentThemeId = settings.get_string('color-theme');
        let selectedIndex = COLOR_THEMES.findIndex(t => t.id === currentThemeId);
        if (selectedIndex < 0)
            selectedIndex = 0;

        const themeRow = new Adw.ComboRow({
            title: _('Color Theme'),
            tooltip_text: _('Choose a curated color palette or switch to custom accent colors.'),
            model: stringList,
            selected: selectedIndex,
        });

        const previewArea = new Gtk.DrawingArea({
            content_width: 130,
            content_height: 24,
            valign: Gtk.Align.CENTER,
        });

        previewArea.set_draw_func((area, cr, width, height) => {
            const currentTheme = settings.get_string('color-theme');
            const customHex = settings.get_string('custom-color');
            const bgHex = settings.get_string('custom-bg-color');
            const palette = getPalette(currentTheme, customHex, bgHex);

            const boxSize = 18;
            const gap = 6;
            const radius = 3;

            for (let i = 0; i < 5; i++) {
                const [r, g, b] = hexToRgb(palette[i]);
                const x = i * (boxSize + gap) + 4;
                const y = 3;

                cr.newSubPath();
                cr.arc(x + radius, y + radius, radius, Math.PI, 1.5 * Math.PI);
                cr.arc(x + boxSize - radius, y + radius, radius, 1.5 * Math.PI, 2 * Math.PI);
                cr.arc(x + boxSize - radius, y + boxSize - radius, radius, 0, 0.5 * Math.PI);
                cr.arc(x + radius, y + boxSize - radius, radius, 0.5 * Math.PI, Math.PI);
                cr.closePath();

                cr.setSourceRGB(r / 255, g / 255, b / 255);
                cr.fill();
            }
        });

        const previewRow = new Adw.ActionRow({
            title: _('Palette Preview'),
            subtitle: _('Levels 0 to 4 preview'),
        });
        previewRow.add_suffix(previewArea);

        themeRow.connect('notify::selected', () => {
            const chosen = COLOR_THEMES[themeRow.selected];
            if (chosen) {
                settings.set_string('color-theme', chosen.id);
                previewArea.queue_draw();
            }
        });

        const customColorRow = new Adw.ActionRow({
            title: _('Custom Accent Color'),
            subtitle: _('Choose a custom color for contributions'),
        });

        let colorButton = null;
        if (Gtk.ColorDialogButton && Gtk.ColorDialog) {
            const colorDialog = new Gtk.ColorDialog({
                with_alpha: false,
            });

            colorButton = new Gtk.ColorDialogButton({
                dialog: colorDialog,
                valign: Gtk.Align.CENTER,
            });

            const initialRgba = new Gdk.RGBA();
            initialRgba.parse(settings.get_string('custom-color') || '#39d353');
            colorButton.set_rgba(initialRgba);

            colorButton.connect('notify::rgba', () => {
                const rgba = colorButton.get_rgba();
                const hex = '#' + [rgba.red, rgba.green, rgba.blue].map(v =>
                    Math.round(v * 255).toString(16).padStart(2, '0')
                ).join('');

                settings.set_string('custom-color', hex);
                const customIndex = COLOR_THEMES.findIndex(t => t.id === 'custom');
                if (themeRow.selected !== customIndex && customIndex >= 0)
                    themeRow.selected = customIndex;
                else
                    previewArea.queue_draw();
            });
        } else if (Gtk.ColorButton) {
            colorButton = new Gtk.ColorButton({
                valign: Gtk.Align.CENTER,
            });

            const initialRgba = new Gdk.RGBA();
            initialRgba.parse(settings.get_string('custom-color') || '#39d353');
            colorButton.set_rgba(initialRgba);

            colorButton.connect('color-set', () => {
                const rgba = colorButton.get_rgba();
                const hex = '#' + [rgba.red, rgba.green, rgba.blue].map(v =>
                    Math.round(v * 255).toString(16).padStart(2, '0')
                ).join('');

                settings.set_string('custom-color', hex);
                const customIndex = COLOR_THEMES.findIndex(t => t.id === 'custom');
                if (themeRow.selected !== customIndex && customIndex >= 0)
                    themeRow.selected = customIndex;
                else
                    previewArea.queue_draw();
            });
        }

        if (colorButton) {
            customColorRow.add_suffix(colorButton);
            customColorRow.set_activatable_widget(colorButton);
        }

        const hexEntryRow = new Adw.EntryRow({
            title: _('Custom Hex Code'),
        });
        settings.bind('custom-color', hexEntryRow, 'text', Gio.SettingsBindFlags.DEFAULT);

        hexEntryRow.connect('changed', row => {
            const text = row.text.trim();
            if (/^#?[0-9a-fA-F]{6}$/.test(text)) {
                const normalized = text.startsWith('#') ? text : `#${text}`;
                const rgba = new Gdk.RGBA();
                if (rgba.parse(normalized) && colorButton)
                    colorButton.set_rgba(rgba);

                const customIndex = COLOR_THEMES.findIndex(t => t.id === 'custom');
                if (themeRow.selected !== customIndex && customIndex >= 0)
                    themeRow.selected = customIndex;
                else
                    previewArea.queue_draw();
            }
        });

        colorGroup.add(themeRow);
        colorGroup.add(previewRow);
        colorGroup.add(customColorRow);
        colorGroup.add(hexEntryRow);

        const tokenGroup = new Adw.PreferencesGroup({
            title: _('Authentication (Optional)'),
            description: _('Include private contributions and increase API rate limits with a Personal Access Token (PAT). Public contributions do not require authentication.'),
        });

        const tokenRow = new Adw.PasswordEntryRow({
            title: _('GitHub Personal Access Token'),
            tooltip_text: _('A Classic or Fine-grained token with "read:user" or "repo" permission allows fetching private contributions via the GitHub GraphQL API.'),
        });
        settings.bind('github-token', tokenRow, 'text', Gio.SettingsBindFlags.DEFAULT);

        const tokenHelpRow = new Adw.ActionRow({
            title: _('Setup GitHub Token'),
            subtitle: _('Generate a Personal Access Token with pre-filled "read:user" scope'),
            tooltip_text: _('Click to open github.com/settings/tokens in your browser.'),
        });

        const openLinkButton = new Gtk.LinkButton({
            uri: 'https://github.com/settings/tokens/new?description=GNOME+Contribution+Grid&scopes=read:user',
            label: _('Generate Token'),
            valign: Gtk.Align.CENTER,
            tooltip_text: _('Open GitHub token generator in web browser'),
        });
        tokenHelpRow.add_suffix(openLinkButton);
        tokenHelpRow.set_activatable_widget(openLinkButton);

        tokenGroup.add(tokenRow);
        tokenGroup.add(tokenHelpRow);

        page.add(generalGroup);
        page.add(colorGroup);
        page.add(tokenGroup);
        window.add(page);
    }
}
