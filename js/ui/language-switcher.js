/**
 * MediaFlow - Language Switcher UI Controller
 * Manages header language dropdown, settings selector, and syncs UI across runtime
 */

var LanguageSwitcher = (function () {
    let elements = {};

    function cacheElements() {
        elements = {
            btnDropdown: document.getElementById('btn-lang-dropdown'),
            headerLangCode: document.getElementById('header-lang-code'),
            headerLangMenu: document.getElementById('header-lang-menu'),
            settingsSelect: document.getElementById('settings-language-select')
        };
    }

    /**
     * Render items inside header dropdown menu
     */
    function renderDropdownMenu() {
        if (!elements.headerLangMenu) return;

        const languages = I18N.getLanguages();
        let html = '';

        languages.forEach(function (lang) {
            const activeClass = lang.active ? 'active' : '';
            const checkIcon = lang.active ? '<i class="fa-solid fa-check" style="color: var(--accent); font-size: 11px;"></i>' : '';

            html += `<div class="lang-dropdown-item ${activeClass}" data-lang="${lang.code}">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="lang-pill-code">${lang.code.toUpperCase()}</span>
                    <span style="font-size: 11px; font-weight: 500;">${lang.nativeName}</span>
                </div>
                ${checkIcon}
            </div>`;
        });

        elements.headerLangMenu.innerHTML = html;

        // Bind clicks on dropdown items
        const items = elements.headerLangMenu.querySelectorAll('.lang-dropdown-item');
        items.forEach(function (item) {
            item.addEventListener('click', function (e) {
                e.stopPropagation();
                const code = this.getAttribute('data-lang');
                if (code) {
                    I18N.setLanguage(code);
                    closeDropdown();
                }
            });
        });
    }

    /**
     * Populate settings tab language select dropdown
     */
    function populateSettingsSelect() {
        if (!elements.settingsSelect) return;

        const languages = I18N.getLanguages();
        let html = '';

        languages.forEach(function (lang) {
            const selected = lang.active ? 'selected' : '';
            html += `<option value="${lang.code}" ${selected}>${lang.nativeName} (${lang.name})</option>`;
        });

        elements.settingsSelect.innerHTML = html;
    }

    /**
     * Update current UI indicators
     */
    function updateIndicators(code) {
        if (elements.headerLangCode) {
            elements.headerLangCode.textContent = code.toUpperCase();
        }
        if (elements.settingsSelect) {
            elements.settingsSelect.value = code;
        }
        renderDropdownMenu();
    }

    function toggleDropdown(e) {
        if (e) e.stopPropagation();
        if (!elements.headerLangMenu) return;
        var isActive = elements.headerLangMenu.classList.toggle('active');
        if (isActive) {
            var gt = document.getElementById('global-tooltip');
            if (gt) gt.classList.remove('visible');
        }
    }

    function closeDropdown() {
        if (elements.headerLangMenu) {
            elements.headerLangMenu.classList.remove('active');
        }
    }

    /**
     * Bind UI events
     */
    function bindEvents() {
        if (elements.btnDropdown) {
            elements.btnDropdown.addEventListener('click', toggleDropdown);
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', function (e) {
            if (elements.headerLangMenu && elements.headerLangMenu.classList.contains('active')) {
                if (elements.btnDropdown && !elements.btnDropdown.contains(e.target) && !elements.headerLangMenu.contains(e.target)) {
                    closeDropdown();
                }
            }
        });

        if (elements.settingsSelect) {
            elements.settingsSelect.addEventListener('change', function () {
                I18N.setLanguage(this.value);
            });
        }

        // Listen for language changes via EventBus
        if (typeof EventBus !== 'undefined') {
            EventBus.on('LANGUAGE_CHANGED', function (data) {
                updateIndicators(data.lang);
            });
        }
    }

    // Public API
    return {
        init: function () {
            cacheElements();
            bindEvents();
            renderDropdownMenu();
            populateSettingsSelect();
            updateIndicators(I18N.getLanguage());
        },
        updateIndicators: updateIndicators
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LanguageSwitcher;
}

