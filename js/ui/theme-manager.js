/**
 * MediaFlow - Theme Manager
 * Synchronizes extension theme dynamically with Adobe After Effects skin brightness.
 * Version: 1.0 (Phase 1 Core Polish)
 */

var ThemeManager = (function () {
    'use strict';

    /**
     * Convert an Adobe RGB object ({red, green, blue, alpha}) to a hex string
     */
    function toHex(color) {
        if (!color) return '#1e1e1e';
        var r = Math.round(color.red).toString(16);
        var g = Math.round(color.green).toString(16);
        var b = Math.round(color.blue).toString(16);
        return '#' + (r.length === 1 ? '0' + r : r) +
                     (g.length === 1 ? '0' + g : g) +
                     (b.length === 1 ? '0' + b : b);
    }

    /**
     * Adjust color brightness by a percentage (-100 to +100)
     */
    function adjustColor(color, percent) {
        if (!color) return '#222222';
        var r = Math.min(255, Math.max(0, Math.round(color.red + (255 * percent / 100))));
        var g = Math.min(255, Math.max(0, Math.round(color.green + (255 * percent / 100))));
        var b = Math.min(255, Math.max(0, Math.round(color.blue + (255 * percent / 100))));
        var rHex = r.toString(16);
        var gHex = g.toString(16);
        var bHex = b.toString(16);
        return '#' + (rHex.length === 1 ? '0' + rHex : rHex) +
                     (gHex.length === 1 ? '0' + gHex : gHex) +
                     (bHex.length === 1 ? '0' + bHex : bHex);
    }

    /**
     * Synchronize CSS variables with AE host skin
     */
    function syncTheme() {
        if (!CEPBridge.isCEPEnvironment()) {
            console.log('[ThemeManager] Running in browser mode - using default dark theme');
            return;
        }

        var cs = CEPBridge.getCSInterface();
        if (!cs) return;

        try {
            var hostEnv = cs.getHostEnvironment();
            if (!hostEnv || !hostEnv.appSkinInfo) return;

            var skin = hostEnv.appSkinInfo;
            var panelBg = skin.panelBackgroundColor ? skin.panelBackgroundColor.color : { red: 30, green: 30, blue: 30 };

            // Perceived luminance formula (ITU-R BT.601)
            var luminance = (panelBg.red * 0.299 + panelBg.green * 0.587 + panelBg.blue * 0.114);
            var isDark = luminance < 128;

            var root = document.documentElement;
            var bgPanelHex = toHex(panelBg);
            var bgHeaderHex = adjustColor(panelBg, isDark ? -8 : -10);
            var bgLogHex = adjustColor(panelBg, isDark ? -10 : -12);
            var bgModalHex = adjustColor(panelBg, isDark ? 4 : -4);
            var bgButtonHex = adjustColor(panelBg, isDark ? 8 : -8);
            var borderIdleHex = adjustColor(panelBg, isDark ? 16 : -20);
            var borderHoverHex = adjustColor(panelBg, isDark ? 32 : -35);

            root.style.setProperty('--bg-panel', bgPanelHex);
            root.style.setProperty('--bg-header', bgHeaderHex);
            root.style.setProperty('--bg-log', bgLogHex);
            root.style.setProperty('--bg-modal', bgModalHex);
            root.style.setProperty('--bg-surface', bgModalHex);
            root.style.setProperty('--bg-tertiary', bgButtonHex);
            root.style.setProperty('--bg-button', bgButtonHex);
            root.style.setProperty('--border-idle', borderIdleHex);
            root.style.setProperty('--border-hover', borderHoverHex);

            if (isDark) {
                root.style.setProperty('--text-primary', '#f5f5f5');
                root.style.setProperty('--text-secondary', '#aaaaaa');
                root.style.setProperty('--text-muted', '#777777');
                root.classList.remove('theme-light');
                root.classList.add('theme-dark');
            } else {
                root.style.setProperty('--text-primary', '#151515');
                root.style.setProperty('--text-secondary', '#444444');
                root.style.setProperty('--text-muted', '#888888');
                root.classList.remove('theme-dark');
                root.classList.add('theme-light');
            }

            // System highlight color from AE (e.g. blue / cyan accent)
            if (skin.systemHighlightColor) {
                var accentHex = toHex(skin.systemHighlightColor.color);
                if (accentHex && accentHex !== '#000000') {
                    root.style.setProperty('--accent', accentHex);
                }
            }

            console.log('[ThemeManager] Theme synchronized: ' + (isDark ? 'Dark' : 'Light') + ' (' + bgPanelHex + ')');
        } catch (e) {
            console.warn('[ThemeManager] Error synchronizing theme:', e);
        }
    }

    /**
     * Initialize theme listeners
     */
    function init() {
        if (!CEPBridge.isCEPEnvironment()) return;

        var cs = CEPBridge.getCSInterface();
        if (cs) {
            syncTheme();
            cs.addEventListener(CSInterface.THEME_COLOR_CHANGED_EVENT, syncTheme);
            console.log('[ThemeManager] Initialized with ThemeColorChanged listener');
        }
    }

    return {
        init: init,
        syncTheme: syncTheme
    };
})();

