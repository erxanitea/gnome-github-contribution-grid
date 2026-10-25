import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Soup from 'gi://Soup';
import St from 'gi://St';

import {Extension, gettext as _, ngettext} from 'resource:///org/gnome/shell/extensions/extension.js';
import {getPalette} from './colorThemes.js';
import {
    buildContributionsUrl,
    buildWeekColumns,
    formatContributionLabel,
    getContributionLevel,
    getContributionRange,
    isValidUsername,
    normalizeUsername,
    parseCachedResult,
    parseContributionHtml,
    parseContributionSvg,
    serializeCachedResult,
    summarizeContributions,
} from './contributionData.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const DECODER = new TextDecoder();
const ENCODER = new TextEncoder();

function createBoxLayout(params = {}) {
    const {vertical, spacing, ...rest} = params;
    const box = new St.BoxLayout(rest);
    if (vertical !== undefined) {
        if ('orientation' in box)
            box.orientation = vertical ? Clutter.Orientation.VERTICAL : Clutter.Orientation.HORIZONTAL;
        else if ('vertical' in box)
            box.vertical = Boolean(vertical);
    }
    if (spacing !== undefined) {
        if ('spacing' in box) {
            box.spacing = spacing;
        } else if (box.layout_manager && 'spacing' in box.layout_manager) {
            box.layout_manager.spacing = spacing;
        }
    }
    return box;
}

async function fetchGraphQLContributions(session, username, token) {
    Gio._promisify(Soup.Session.prototype, 'send_and_read_async', 'send_and_read_finish');

    const query = JSON.stringify({
        query: `query($login: String!) {
            user(login: $login) {
                contributionsCollection {
                    contributionCalendar {
                        totalContributions
                        weeks {
                            contributionDays {
                                contributionCount
                                date
                                contributionLevel
                            }
                        }
                    }
                }
            }
        }`,
        variables: {login: username},
    });

    const message = Soup.Message.new('POST', 'https://api.github.com/graphql');
    message.request_headers.append('User-Agent', 'github-contribution-grid-extension');
    message.request_headers.append('Authorization', `Bearer ${token}`);
    message.request_headers.append('Content-Type', 'application/json');

    const requestBytes = GLib.Bytes.new(ENCODER.encode(query));
    message.set_request_body_from_bytes('application/json', requestBytes);

    const responseBytes = await session.send_and_read_async(
        message,
        GLib.PRIORITY_DEFAULT,
        null
    );

    const statusCode = message.get_status();
    if (statusCode !== Soup.Status.OK)
        throw new Error(`GraphQL returned HTTP ${statusCode}`);

    const json = JSON.parse(DECODER.decode(responseBytes.get_data()));
    if (json.errors || !json.data?.user?.contributionsCollection?.contributionCalendar)
        throw new Error(json.errors?.[0]?.message || 'No contribution data in GraphQL response');

    const calendar = json.data.user.contributionsCollection.contributionCalendar;
    const levelMap = {
        'NONE': 0,
        'FIRST_QUARTILE': 1,
        'SECOND_QUARTILE': 2,
        'THIRD_QUARTILE': 3,
        'FOURTH_QUARTILE': 4,
    };

    const days = [];
    for (const week of calendar.weeks) {
        for (const day of week.contributionDays) {
            days.push({
                date: day.date,
                count: day.contributionCount,
                level: levelMap[day.contributionLevel] ?? 0,
            });
        }
    }

    const {total, maxCount, longestStreak} = summarizeContributions(days);
    const range = getContributionRange(days);

    return {days, total, maxCount, longestStreak, range};
}

async function fetchPublicContributions(session, username) {
    Gio._promisify(Soup.Session.prototype, 'send_and_read_async', 'send_and_read_finish');

    const message = Soup.Message.new('GET', buildContributionsUrl(username));
    message.request_headers.append('User-Agent', 'github-contribution-grid-extension');

    const bytes = await session.send_and_read_async(
        message,
        GLib.PRIORITY_DEFAULT,
        null
    );

    const statusCode = message.get_status();
    if (statusCode !== Soup.Status.OK)
        throw new Error(`GitHub returned HTTP ${statusCode}`);

    const svg = DECODER.decode(bytes.get_data());
    let days = parseContributionSvg(svg);
    if (days.length === 0)
        days = parseContributionHtml(svg);

    const {total, maxCount, longestStreak} = summarizeContributions(days);
    const range = getContributionRange(days);

    return {days, total, maxCount, longestStreak, range};
}

async function fetchContributions(session, username, token = '') {
    if (token) {
        try {
            return await fetchGraphQLContributions(session, username, token);
        } catch (error) {
            console.warn(`[Github Contribution Grid] GraphQL request failed: ${error.message}`);
            return await fetchPublicContributions(session, username);
        }
    }
    return await fetchPublicContributions(session, username);
}

const GithubGridIndicator = GObject.registerClass(
class GithubGridIndicator extends PanelMenu.Button {
    _init(extension, settings, session) {
        super._init(0.0, extension.metadata.name, false);
        this.accessible_name = extension.metadata.name;
        this._extension = extension;
        this._settings = settings;
        this._session = session;
        this._refreshSourceId = null;
        this._isRefreshing = false;
        this._requestSerial = 0;
        this._lastResult = null;

        this._panelBox = createBoxLayout({
            vertical: false,
            spacing: 3,
            accessible_role: Atk.Role.PANEL,
            accessible_name: _('Recent contributions'),
            style_class: 'github-grid-panel-box',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._panelCells = [];
        for (let i = 0; i < 7; i++) {
            const cell = new St.Widget({
                accessible_role: Atk.Role.TABLE_CELL,
                accessible_name: _('No contributions'),
                style_class: 'github-grid-panel-cell',
                width: 14,
                height: 14,
                reactive: false,
                can_focus: false,
            });
            this._panelCells.push(cell);
            this._panelBox.add_child(cell);
        }

        this.add_child(this._panelBox);

        const popupItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
        });

        this._content = createBoxLayout({
            vertical: true,
            spacing: 12,
            accessible_role: Atk.Role.PANEL,
            style_class: 'github-grid-popup',
        });

        this._title = new St.Label({
            text: _('GitHub Contributions'),
            accessible_role: Atk.Role.HEADING,
            style_class: 'github-grid-title',
            x_align: Clutter.ActorAlign.START,
        });

        this._stateLabel = new St.Label({
            text: '',
            accessible_role: Atk.Role.STATUSBAR,
            style_class: 'github-grid-state',
            x_align: Clutter.ActorAlign.START,
        });

        this._hintLabel = new St.Label({
            text: '',
            accessible_role: Atk.Role.LABEL,
            style_class: 'github-grid-hint',
            x_align: Clutter.ActorAlign.START,
        });

        this._summaryLabel = new St.Label({
            text: '',
            accessible_role: Atk.Role.LABEL,
            style_class: 'github-grid-summary',
            x_align: Clutter.ActorAlign.START,
        });

        this._gridFrame = createBoxLayout({
            style_class: 'github-grid-frame',
            x_expand: true,
        });
        this._gridFrame.label_actor = this._title;

        this._grid = createBoxLayout({
            spacing: 2,
            style_class: 'github-grid',
            x_expand: true,
        });

        this._gridFrame.add_child(this._grid);

        this._content.add_child(this._title);
        this._content.add_child(this._stateLabel);
        this._content.add_child(this._hintLabel);
        this._content.add_child(this._summaryLabel);
        this._content.add_child(this._gridFrame);
        popupItem.add_child(this._content);
        this.menu.addMenuItem(popupItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._refreshItem = new PopupMenu.PopupMenuItem(_('Refresh now'));
        this._refreshItem.connect('activate', () => {
            void this.refresh();
        });
        this.menu.addMenuItem(this._refreshItem);

        this._prefsItem = new PopupMenu.PopupMenuItem(_('Preferences'));
        this._prefsItem.connect('activate', () => {
            this._extension.openPreferences();
        });
        this.menu.addMenuItem(this._prefsItem);

        this._settings.connectObject(
            'changed::username', () => void this.refresh(),
            'changed::refresh-interval-minutes', () => this.startAutoRefresh(),
            'changed::github-token', () => void this.refresh(),
            'changed::color-theme', () => this._onThemeChanged(),
            'changed::custom-color', () => this._onThemeChanged(),
            'changed::custom-bg-color', () => this._onThemeChanged(),
            this
        );

        this.connect('destroy', () => this._onDestroy());

        if (!this._getUsername())
            this.showUnconfiguredState();
        else
            this.showLoadingState();
    }

    _getPalette() {
        const themeId = this._settings.get_string('color-theme') || 'github';
        const customColor = this._settings.get_string('custom-color') || '#39d353';
        const customBg = this._settings.get_string('custom-bg-color') || '#2d333b';
        return getPalette(themeId, customColor, customBg);
    }

    _onThemeChanged() {
        this._updatePanelColors();
        if (this._lastResult)
            this._renderGrid(this._lastResult);
    }

    _updatePanelColors() {
        const palette = this._getPalette();
        if (!this._lastResult || !this._lastResult.days || this._lastResult.days.length === 0) {
            const emptyColor = palette[0];
            for (let i = 0; i < 7; i++) {
                this._panelCells[i].set_style(`background-color: ${emptyColor};`);
                this._panelCells[i].accessible_name = _('No contributions');
                this._panelCells[i].opacity = 140;
            }
            return;
        }

        const sortedDays = [...this._lastResult.days].sort((left, right) => left.date.localeCompare(right.date));
        const recentDays = sortedDays.slice(-7);
        for (let i = 0; i < 7; i++) {
            const day = recentDays[i];
            const level = day ? (day.level ?? getContributionLevel(day.count, this._lastResult.maxCount)) : 0;
            const color = palette[level] ?? palette[0];
            this._panelCells[i].set_style(`background-color: ${color};`);
            if (day)
                this._panelCells[i].accessible_name = formatContributionLabel(day);
            this._panelCells[i].opacity = 255;
        }
    }

    async refresh() {
        if (this._isRefreshing)
            return;

        const username = this._getUsername();
        if (!username) {
            this.showUnconfiguredState();
            return;
        }

        if (!isValidUsername(username)) {
            this.showErrorState(
                _('Invalid GitHub username: %s').format(username),
                _('Use only letters, numbers, and single hyphens between characters.')
            );
            return;
        }

        this._isRefreshing = true;
        const requestSerial = ++this._requestSerial;
        this._refreshItem.setSensitive(false);
        this.showLoadingState(username);

        try {
            const token = this._getGithubToken();
            const result = await fetchContributions(this._session, username, token);
            if (requestSerial !== this._requestSerial)
                return;

            if (result.days.length === 0) {
                this.showEmptyState(username);
                return;
            }

            this._settings.set_string(
                'cached-result',
                serializeCachedResult(username, result)
            );
            this.showLoadedState(username, result);
        } catch (error) {
            if (requestSerial !== this._requestSerial)
                return;

            console.error(`[Github Contribution Grid] Error refreshing contributions: ${error.message}`);
            this.showErrorState(
                _('Unable to load @%s.').format(username),
                error.message
            );
        } finally {
            if (requestSerial !== this._requestSerial)
                return;

            this._refreshItem.setSensitive(true);
            this._isRefreshing = false;
        }
    }

    startAutoRefresh() {
        this.stopAutoRefresh();

        const minutes = this._getRefreshIntervalMinutes();
        this._refreshSourceId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            minutes * 60,
            () => {
                void this.refresh();
                return GLib.SOURCE_CONTINUE;
            }
        );

        GLib.Source.set_name_by_id(this._refreshSourceId, '[github-grid] auto-refresh');
    }

    stopAutoRefresh() {
        if (this._refreshSourceId !== null) {
            GLib.Source.remove(this._refreshSourceId);
            this._refreshSourceId = null;
        }
    }

    showLoadingState(username = '') {
        this._clearGrid();
        this._updatePanelColors();
        this._content.add_accessible_state(Atk.StateType.BUSY);
        const target = username ? ` for @${username}` : '';
        this._setState(
            _('Loading contribution grid%s...').format(target),
            _('Fetching public contribution data from GitHub.')
        );
    }

    showUnconfiguredState() {
        this._clearGrid();
        this._updatePanelColors();
        this._content.remove_accessible_state(Atk.StateType.BUSY);
        this._setState(
            _('GitHub Username Not Configured'),
            _('Open Preferences to enter your GitHub username.')
        );
        this._summaryLabel.text = '';
    }

    showEmptyState(username = '') {
        this._clearGrid();
        this._updatePanelColors();
        this._content.remove_accessible_state(Atk.StateType.BUSY);
        const target = username ? ` for @${username}` : '';
        this._setState(
            _('No contribution data available%s.').format(target),
            _('GitHub returned no contribution cells for the selected period.')
        );
        this._summaryLabel.text = '';
    }

    showLoadedState(username, result) {
        this._lastResult = result;
        this._updatePanelColors();
        this._content.remove_accessible_state(Atk.StateType.BUSY);
        this._renderGrid(result);
        this._setState(
            _('Loaded %d daily cells for @%s.').format(result.days.length, username),
            _('Public contributions from %s to %s.').format(result.range.from, result.range.to)
        );
        this._summaryLabel.text = _('Total: %d | Peak day: %d | Longest streak: %d').format(
            result.total,
            result.maxCount,
            result.longestStreak
        );
    }

    restoreCachedState() {
        const username = this._getUsername();
        if (!username)
            return false;

        const cached = parseCachedResult(this._settings.get_string('cached-result'));
        if (!cached || cached.username !== username)
            return false;

        const summary = cached.result.summary || summarizeContributions(cached.result.days);
        const range = cached.result.range || getContributionRange(cached.result.days);
        const fetchResult = {
            days: cached.result.days,
            total: summary.total,
            maxCount: summary.maxCount,
            longestStreak: summary.longestStreak,
            range,
        };

        this.showLoadedState(cached.username, fetchResult);
        this._hintLabel.text = _('Showing cached data from %s until refresh completes.').format(cached.cachedAt);
        return true;
    }

    showErrorState(message = _('Unable to load contribution data.'), hint = _('Check the username or network access.')) {
        this._clearGrid();
        this._content.remove_accessible_state(Atk.StateType.BUSY);
        this._setState(
            message,
            hint
        );
        this._stateLabel.add_style_class_name('github-grid-state-error');
        for (let i = 0; i < 7; i++) {
            this._panelCells[i].set_style('background-color: #ff7b72;');
            this._panelCells[i].accessible_name = _('Error loading contributions');
            this._panelCells[i].opacity = 180;
        }
    }

    _setState(stateText, hintText) {
        this._stateLabel.remove_style_class_name('github-grid-state-error');
        this._stateLabel.text = stateText;
        this._hintLabel.text = hintText;
        if (!this._grid.visible)
            this._summaryLabel.text = '';
    }

    _getUsername() {
        return normalizeUsername(this._settings.get_string('username'));
    }

    _getRefreshIntervalMinutes() {
        return Math.max(5, this._settings.get_int('refresh-interval-minutes'));
    }

    _getGithubToken() {
        return this._settings.get_string('github-token').trim();
    }

    _clearGrid() {
        this._grid.destroy_all_children();
        this._grid.hide();
    }

    _renderGrid(result) {
        this._clearGrid();

        const palette = this._getPalette();
        const weeks = buildWeekColumns(result.days, result.maxCount);
        for (const weekDays of weeks) {
            const weekColumn = createBoxLayout({
                vertical: true,
                spacing: 2,
                accessible_role: Atk.Role.PANEL,
                style_class: 'github-grid-week',
            });

            for (const day of weekDays) {
                const cell = new St.Widget({
                    accessible_role: Atk.Role.TABLE_CELL,
                    accessible_name: formatContributionLabel(day),
                    style_class: `github-grid-cell github-grid-cell-level-${day.level}`,
                    width: 10,
                    height: 10,
                    reactive: true,
                    track_hover: true,
                });
                const color = palette[day.level] ?? palette[0];
                cell.set_style(`background-color: ${color};`);
                cell.connect('notify::hover', () => {
                    if (cell.hover) {
                        cell.opacity = 200;
                        this._hintLabel.text = formatContributionLabel(day);
                    } else {
                        cell.opacity = 255;
                        this._hintLabel.text = _('Public contributions from the last year.');
                    }
                });
                weekColumn.add_child(cell);
            }

            this._grid.add_child(weekColumn);
        }

        this._grid.show();
    }

    _onDestroy() {
        this._requestSerial += 1;
        this._isRefreshing = false;
        this.stopAutoRefresh();

        if (this._settings) {
            this._settings.disconnectObject(this);
            this._settings = null;
        }
        if (this._gridFrame)
            this._gridFrame.label_actor = null;

        this._panelCells = [];
        this._panelBox = null;
        this._prefsItem = null;
        this._refreshItem = null;
        this._grid = null;
        this._gridFrame = null;
        this._summaryLabel = null;
        this._hintLabel = null;
        this._stateLabel = null;
        this._title = null;
        this._content = null;
        this._session = null;
        this._extension = null;
    }
});

export default class GithubGridExtension extends Extension {
    enable() {
        this._session = new Soup.Session();
        this._indicator = new GithubGridIndicator(this, this.getSettings(), this._session);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
        this._indicator.startAutoRefresh();
        this._indicator.restoreCachedState();
        void this._indicator.refresh();
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        if (this._session) {
            this._session.abort();
            this._session = null;
        }
    }
}
