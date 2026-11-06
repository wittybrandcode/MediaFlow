/**
 * MediaFlow - Enterprise Internationalization (i18n) Engine
 * Handles multi-language registration, host locale auto-detection, dynamic DOM translation,
 * and persistent language selection (SOLID: Open/Closed Principle)
 */

var I18N = (function () {
    // Registry of supported languages
    const languages = {};
    let activeLanguageCode = 'en'; // default fallback
    let isInitialized = false;

    const STORAGE_KEY = 'mediaflow_language';

    /**
     * Register a new language bundle
     * @param {string} code - e.g. 'en', 'ar', 'fr', 'es'
     * @param {object} options - { name, nativeName, dir, translations }
     */
    function registerLanguage(code, options) {
        if (!code || !options) return;
        languages[code] = {
            code: code,
            name: options.name || code,
            nativeName: options.nativeName || options.name || code,
            dir: options.dir === 'rtl' ? 'rtl' : 'ltr',
            translations: options.translations || {}
        };
    }

    /**
     * Auto-detect language from Adobe After Effects host environment or browser
     * @returns {string} Detected language code if supported, or 'en'
     */
    function detectHostLanguage() {
        try {
            // 1. Try CEP host environment appUILocale (e.g. "en_US", "ar_AE", "fr_FR")
            if (typeof csInterface !== 'undefined' && csInterface.getHostEnvironment) {
                const hostEnv = csInterface.getHostEnvironment();
                if (hostEnv && hostEnv.appUILocale) {
                    const locale = hostEnv.appUILocale.toLowerCase();
                    const langCode = locale.split('_')[0].split('-')[0];
                    if (languages[langCode]) {
                        console.log('[i18n] Detected AE host language:', langCode, '(' + hostEnv.appUILocale + ')');
                        return langCode;
                    }
                }
            }

            // 2. Try Browser / CEF navigator.language
            if (typeof navigator !== 'undefined' && navigator.language) {
                const navLang = navigator.language.toLowerCase().split('-')[0];
                if (languages[navLang]) {
                    console.log('[i18n] Detected system/browser language:', navLang);
                    return navLang;
                }
            }
        } catch (e) {
            console.warn('[i18n] Host language detection fallback:', e);
        }

        return 'en'; // Default to studio English
    }

    /**
     * Initialize the i18n engine
     */
    function init() {
        if (isInitialized) return;

        // 1. Check user preference in localStorage
        let selected = null;
        try {
            selected = localStorage.getItem(STORAGE_KEY);
        } catch (e) { }

        // 2. If no valid saved preference, auto-detect from After Effects
        if (!selected || !languages[selected]) {
            selected = detectHostLanguage();
        }

        activeLanguageCode = selected;
        applyLanguage(activeLanguageCode, false);
        isInitialized = true;
    }

    /**
     * Set active language and re-translate interface
     * @param {string} code - Target language code
     */
    function setLanguage(code) {
        if (!languages[code]) {
            console.warn('[i18n] Language not registered:', code);
            return false;
        }

        activeLanguageCode = code;

        // Persist choice
        try {
            localStorage.setItem(STORAGE_KEY, code);
        } catch (e) { }

        applyLanguage(code, true);

        // Notify EventBus if available
        if (typeof EventBus !== 'undefined') {
            EventBus.emit('LANGUAGE_CHANGED', {
                lang: code,
                dir: languages[code].dir
            });
        }

        return true;
    }

    /**
     * Apply language direction, DOM attributes, and update all translated text
     */
    function applyLanguage(code, triggerCallback) {
        const langConfig = languages[code] || languages['en'] || { dir: 'ltr' };

        // 1. Set document direction and language attributes
        if (typeof document !== 'undefined') {
            document.documentElement.dir = langConfig.dir;
            document.documentElement.lang = code;

            // Toggle body class for direction-specific styling
            document.body.classList.remove('lang-ltr', 'lang-rtl');
            document.body.classList.add(langConfig.dir === 'rtl' ? 'lang-rtl' : 'lang-ltr');
            document.body.setAttribute('data-current-lang', code);

            // 2. Translate entire DOM
            translateDOM();
        }
    }

    /**
     * Resolve a nested translation key path (e.g. "auditor.missingEffects")
     * @param {string} keyPath
     * @param {object} dict
     * @returns {*}
     */
    function getNestedValue(keyPath, dict) {
        if (!dict || !keyPath) return null;
        const parts = keyPath.split('.');
        let current = dict;
        for (let i = 0; i < parts.length; i++) {
            if (current && typeof current === 'object' && parts[i] in current) {
                current = current[parts[i]];
            } else {
                return null;
            }
        }
        return current;
    }

    /**
     * Translate a key with parameter interpolation and English fallback
     * @param {string} keyPath - e.g. "tabs.import" or "auditor.foundMissing"
     * @param {object} params - Optional interpolation parameters { count: 5 }
     * @param {string} fallback - Optional fallback string if key is not found
     * @returns {string} Translated text
     */
    function t(keyPath, params, fallback) {
        const activeDict = languages[activeLanguageCode] ? languages[activeLanguageCode].translations : null;
        const englishDict = languages['en'] ? languages['en'].translations : null;

        // 1. Try active language
        let value = getNestedValue(keyPath, activeDict);

        // 2. Fallback to English
        if (value === null && englishDict) {
            value = getNestedValue(keyPath, englishDict);
        }

        // 3. Fallback to passed fallback or keyPath
        if (value === null) {
            value = (fallback !== undefined) ? fallback : keyPath;
        }

        // 4. Parameter Interpolation (e.g. "{count} files")
        if (typeof value === 'string' && params && typeof params === 'object') {
            for (let paramKey in params) {
                if (params.hasOwnProperty(paramKey)) {
                    const regex = new RegExp('\\{' + paramKey + '\\}', 'g');
                    value = value.replace(regex, params[paramKey]);
                }
            }
        }

        return value;
    }

    /**
     * Translate all reactive DOM elements within a root container
     * @param {HTMLElement} root - Defaults to document.body
     */
    function translateDOM(root) {
        root = root || document.body;
        if (!root) return;

        // 1. Text elements: data-i18n="section.key"
        const textElements = root.querySelectorAll('[data-i18n]');
        for (let i = 0; i < textElements.length; i++) {
            const el = textElements[i];
            const key = el.getAttribute('data-i18n');
            if (key) {
                // If element has icon children with text, preserve icon
                const icon = el.querySelector('i');
                const translated = t(key);
                if (icon) {
                    // Check if icon is before or after
                    const iconHtml = icon.outerHTML;
                    el.innerHTML = iconHtml + ' ' + translated;
                } else {
                    el.textContent = translated;
                }
            }
        }

        // 2. Input placeholders: data-i18n-placeholder="section.key"
        const placeholderElements = root.querySelectorAll('[data-i18n-placeholder]');
        for (let j = 0; j < placeholderElements.length; j++) {
            const pEl = placeholderElements[j];
            const pKey = pEl.getAttribute('data-i18n-placeholder');
            if (pKey) {
                pEl.setAttribute('placeholder', t(pKey));
            }
        }

        // 3. Tooltips: data-i18n-tooltip="section.key"
        const tooltipElements = root.querySelectorAll('[data-i18n-tooltip]');
        for (let k = 0; k < tooltipElements.length; k++) {
            const tEl = tooltipElements[k];
            const tKey = tEl.getAttribute('data-i18n-tooltip');
            if (tKey) {
                tEl.setAttribute('data-tooltip', t(tKey));
            }
        }

        // 4. Titles: data-i18n-title="section.key"
        const titleElements = root.querySelectorAll('[data-i18n-title]');
        for (let m = 0; m < titleElements.length; m++) {
            const titleEl = titleElements[m];
            const titleKey = titleEl.getAttribute('data-i18n-title');
            if (titleKey) {
                titleEl.setAttribute('title', t(titleKey));
            }
        }
    }

    /**
     * Get list of all registered languages for dropdowns / UI selectors
     * @returns {Array} List of language descriptors
     */
    function getLanguages() {
        const list = [];
        for (let code in languages) {
            if (languages.hasOwnProperty(code)) {
                list.push({
                    code: code,
                    name: languages[code].name,
                    nativeName: languages[code].nativeName,
                    dir: languages[code].dir,
                    active: (code === activeLanguageCode)
                });
            }
        }
        return list;
    }

    // Public API
    return {
        registerLanguage: registerLanguage,
        init: init,
        setLanguage: setLanguage,
        getLanguage: function () { return activeLanguageCode; },
        getLanguages: getLanguages,
        isRTL: function () { return languages[activeLanguageCode] && languages[activeLanguageCode].dir === 'rtl'; },
        t: t,
        translateDOM: translateDOM,
        detectHostLanguage: detectHostLanguage
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = I18N;
}

