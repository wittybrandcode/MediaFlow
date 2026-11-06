/**
 * Smart Controller - Handles UI events and features for Smart Maintenance tab (SOLID: Single Responsibility)
 * Fully localized with I18N Engine
 */

var SmartController = (function () {
    // In-memory state for latest audits
    let latestAudit = null;
    let latestOrphanAudit = null;

    // Cache DOM elements
    let elements = {};

    function _t(key, params, fallback) {
        if (typeof I18N !== 'undefined') {
            return I18N.t(key, params, fallback);
        }
        return fallback || key;
    }

    /**
     * Cache needed DOM elements
     */
    function cacheElements() {
        elements = {
            // Quick Toolbar Buttons
            btnIsolateMissing: document.getElementById('btn-isolate-missing'),
            btnIsolateUnused: document.getElementById('btn-isolate-unused'),
            btnRemoveUnused: document.getElementById('btn-remove-unused'),
            btnPurgeCache: document.getElementById('btn-purge-cache'),

            // Card 1: Auditor
            btnRunAuditor: document.getElementById('btn-run-auditor'),
            btnViewAuditReport: document.getElementById('btn-view-audit-report'),
            badgeEffects: document.getElementById('smart-badge-effects'),
            badgeFonts: document.getElementById('smart-badge-fonts'),

            // Card 2: Orphan Cleaner
            btnRunOrphanScan: document.getElementById('btn-run-orphan-scan'),
            btnIsolateOrphansAction: document.getElementById('btn-isolate-orphans-action'),
            btnCleanOrphansAction: document.getElementById('btn-clean-orphans-action'),
            badgeRoots: document.getElementById('smart-badge-roots'),
            badgeOrphans: document.getElementById('smart-badge-orphans'),
            badgeEmptyComps: document.getElementById('smart-badge-empty-comps'),

            // Card 3: Smart Relink
            relinkFolderInput: document.getElementById('smart-relink-folder-input'),
            btnRelinkBrowse: document.getElementById('smart-relink-browse-btn'),
            relinkRecursiveCheck: document.getElementById('smart-relink-recursive'),
            btnExecuteRelink: document.getElementById('btn-execute-relink'),
            badgeMissingFiles: document.getElementById('smart-badge-missing-files'),
            relinkResultMsg: document.getElementById('smart-relink-result-msg'),

            // Card 4: Smart Collect
            collectFolderInput: document.getElementById('smart-collect-folder-input'),
            btnCollectBrowse: document.getElementById('smart-collect-browse-btn'),
            collectUsedOnlyCheck: document.getElementById('smart-collect-used-only'),
            collectOrganizeTypesCheck: document.getElementById('smart-collect-organize-types'),
            collectRelinkCheck: document.getElementById('smart-collect-relink'),
            collectSaveAepCheck: document.getElementById('smart-collect-save-aep'),
            btnExecuteCollect: document.getElementById('btn-execute-collect'),
            collectResultMsg: document.getElementById('smart-collect-result-msg'),

            // Auditor Modal
            auditorModal: document.getElementById('auditor-modal'),
            auditorCloseTop: document.getElementById('auditor-modal-close-top'),
            auditorCloseBtn: document.getElementById('auditor-modal-close-btn'),
            auditorSummaryText: document.getElementById('auditor-summary-text'),
            auditorTabEffectsCount: document.getElementById('auditor-tab-effects-count'),
            auditorTabFontsCount: document.getElementById('auditor-tab-fonts-count'),
            auditorTabAllFontsCount: document.getElementById('auditor-tab-all-fonts-count'),
            auditorTabAllEffectsCount: document.getElementById('auditor-tab-all-effects-count'),
            auditorEffectsList: document.getElementById('auditor-effects-list'),
            auditorFontsList: document.getElementById('auditor-fonts-list'),
            auditorAllFontsList: document.getElementById('auditor-all-fonts-list'),
            auditorAllEffectsList: document.getElementById('auditor-all-effects-list'),

            // Orphan Modal
            orphanModal: document.getElementById('orphan-modal'),
            orphanCloseTop: document.getElementById('orphan-modal-close-top'),
            orphanCancelBtn: document.getElementById('orphan-modal-cancel-btn'),
            orphanModalIsolateBtn: document.getElementById('orphan-modal-isolate-btn'),
            orphanModalDeleteBtn: document.getElementById('orphan-modal-delete-btn'),
            orphanCompsList: document.getElementById('orphan-comps-list'),
            orphanFootageList: document.getElementById('orphan-footage-list')
        };
    }

    // =========================================================================
    // 3.1 AUDITOR LOGIC
    // =========================================================================

    /**
     * Run Missing Fonts & Effects Auditor
     */
    async function runAuditor() {
        if (!elements.btnRunAuditor) return;

        try {
            elements.btnRunAuditor.disabled = true;
            elements.btnRunAuditor.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + _t('common.scan', null, 'Scanning...');

            const response = await AEBridge.auditMissingFontsAndEffects();

            if (response.success && response.data) {
                latestAudit = response.data;
                const stats = latestAudit.stats || {};

                // Update Badges
                const missingEff = stats.missingEffectsCount || 0;
                const missingFnt = stats.missingFontsCount || 0;

                if (elements.badgeEffects) {
                    elements.badgeEffects.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> ' + missingEff + ' ' + _t('smart.badgeMissingEffects', null, 'Missing Effects');
                    elements.badgeEffects.className = missingEff > 0 ? 'comp-badge badge-warning' : 'comp-badge badge-root';
                }
                if (elements.badgeFonts) {
                    elements.badgeFonts.innerHTML = '<i class="fa-solid fa-font"></i> ' + missingFnt + ' ' + _t('smart.badgeMissingFonts', null, 'Missing Fonts');
                    elements.badgeFonts.className = missingFnt > 0 ? 'comp-badge badge-warning' : 'comp-badge badge-root';
                }

                // Enable report viewer button
                if (elements.btnViewAuditReport) elements.btnViewAuditReport.disabled = false;

                // Render tables in modal
                renderAuditorModal(latestAudit);

                if (missingEff === 0 && missingFnt === 0) {
                    if (typeof ToastSystem !== 'undefined') ToastSystem.success(_t('toasts.auditorClean', null, 'Project is completely clean! No missing fonts or effects.'));
                } else {
                    if (typeof ToastSystem !== 'undefined') {
                        ToastSystem.warning(_t('toasts.auditorFoundIssues', { effects: missingEff, fonts: missingFnt }, `Found ${missingEff} missing effects and ${missingFnt} missing fonts.`));
                    }
                    openAuditorModal();
                }
            } else {
                const msg = response.error ? response.error.message : _t('common.error', null, 'Audit Failed');
                if (typeof ToastSystem !== 'undefined') ToastSystem.error(msg);
            }
        } catch (e) {
            if (typeof ToastSystem !== 'undefined') ToastSystem.error('Auditor Error: ' + e.message);
        } finally {
            elements.btnRunAuditor.disabled = false;
            elements.btnRunAuditor.innerHTML = '<i class="fa-solid fa-magnifying-glass-chart"></i> ' + _t('smart.btnRunAuditor', null, 'Scan Project Assets');
        }
    }

    /**
     * Render data inside Auditor Modal
     */
    function renderAuditorModal(data) {
        const missingEffects = data.missingEffects || [];
        const missingFonts = data.missingFonts || [];
        const allFonts = data.allFonts || [];
        const allEffects = data.allEffects || [];
        const stats = data.stats || {};

        // Update Tab Badges
        if (elements.auditorTabEffectsCount) elements.auditorTabEffectsCount.textContent = missingEffects.length;
        if (elements.auditorTabFontsCount) elements.auditorTabFontsCount.textContent = missingFonts.length;
        if (elements.auditorTabAllFontsCount) elements.auditorTabAllFontsCount.textContent = allFonts.length;
        if (elements.auditorTabAllEffectsCount) elements.auditorTabAllEffectsCount.textContent = allEffects.length;

        if (elements.auditorSummaryText) {
            elements.auditorSummaryText.textContent = `Scanned ${stats.scannedComps || 0} comp(s), ${stats.scannedLayers || 0} layer(s).`;
        }

        const colComp = _t('modals.colComp', null, 'Composition');
        const colLayer = _t('modals.colLayer', null, 'Layer');
        const colEffect = _t('modals.colEffect', null, 'Missing Effect');
        const colFont = _t('modals.colFont', null, 'Missing Font');
        const colSample = _t('modals.colSampleText', null, 'Sample Text');
        const colAction = _t('common.actions', null, 'Action');
        const btnRevealText = _t('modals.btnRevealInAe', null, 'Reveal in AE');

        // 1. Missing Effects Table
        if (elements.auditorEffectsList) {
            if (missingEffects.length === 0) {
                elements.auditorEffectsList.innerHTML = '<div style="padding: 24px; text-align: center; color: #4CAF50;"><i class="fa-solid fa-circle-check" style="font-size: 24px; margin-bottom: 8px;"></i><br/>' + _t('smart.allEffectsInstalled', null, 'All 3rd-party effects are installed and active!') + '</div>';
            } else {
                let html = `<table class="auditor-table"><thead><tr><th>${colComp}</th><th>${colLayer}</th><th>${colEffect}</th><th>${colAction}</th></tr></thead><tbody>`;
                missingEffects.forEach(function (eff) {
                    html += `<tr>
                        <td><strong>${escapeHtml(eff.compName)}</strong></td>
                        <td>${escapeHtml(eff.layerName)} (L${eff.layerIndex})</td>
                        <td style="color: #ff9800; font-family: var(--font-mono);">${escapeHtml(eff.effectName)}</td>
                        <td>
                            <button class="auditor-reveal-btn" data-comp-id="${eff.compId}" data-layer-index="${eff.layerIndex}">
                                <i class="fa-solid fa-eye"></i> ${btnRevealText}
                            </button>
                        </td>
                    </tr>`;
                });
                html += '</tbody></table>';
                elements.auditorEffectsList.innerHTML = html;
            }
        }

        // 2. Missing Fonts Table
        if (elements.auditorFontsList) {
            if (missingFonts.length === 0) {
                elements.auditorFontsList.innerHTML = '<div style="padding: 24px; text-align: center; color: #4CAF50;"><i class="fa-solid fa-circle-check" style="font-size: 24px; margin-bottom: 8px;"></i><br/>' + _t('smart.allFontsInstalled', null, 'All fonts used in text layers are installed on your system!') + '</div>';
            } else {
                let html = `<table class="auditor-table"><thead><tr><th>${colComp}</th><th>${colLayer}</th><th>${colFont}</th><th>${colSample}</th><th>${colAction}</th></tr></thead><tbody>`;
                missingFonts.forEach(function (fnt) {
                    html += `<tr>
                        <td><strong>${escapeHtml(fnt.compName)}</strong></td>
                        <td>${escapeHtml(fnt.layerName)} (L${fnt.layerIndex})</td>
                        <td style="color: #ff9800; font-family: var(--font-mono);">${escapeHtml(fnt.fontName)} ${fnt.fontStyle ? '(' + escapeHtml(fnt.fontStyle) + ')' : ''}</td>
                        <td style="color: var(--text-muted); font-size: 10px;">${escapeHtml(fnt.sampleText || '-')}</td>
                        <td>
                            <button class="auditor-reveal-btn" data-comp-id="${fnt.compId}" data-layer-index="${fnt.layerIndex}">
                                <i class="fa-solid fa-eye"></i> ${btnRevealText}
                            </button>
                        </td>
                    </tr>`;
                });
                html += '</tbody></table>';
                elements.auditorFontsList.innerHTML = html;
            }
        }

        // 3. All Fonts Inventory Table
        if (elements.auditorAllFontsList) {
            let html = '<table class="auditor-table"><thead><tr><th>Font Family</th><th>Style</th><th>Usage Count</th><th>Status</th></tr></thead><tbody>';
            allFonts.forEach(function (f) {
                const statusBadge = f.isMissing ? '<span class="comp-badge badge-warning">Missing</span>' : '<span class="comp-badge badge-root">Installed</span>';
                html += `<tr>
                    <td style="font-weight: 500; font-family: var(--font-mono);">${escapeHtml(f.fontName)}</td>
                    <td style="color: var(--text-secondary);">${escapeHtml(f.fontStyle || 'Regular')}</td>
                    <td>${f.count}</td>
                    <td>${statusBadge}</td>
                </tr>`;
            });
            html += '</tbody></table>';
            elements.auditorAllFontsList.innerHTML = html;
        }

        // 4. All Effects Inventory Table
        if (elements.auditorAllEffectsList) {
            let html = '<table class="auditor-table"><thead><tr><th>Effect Name</th><th>Match Name</th><th>Usage Count</th><th>Status</th></tr></thead><tbody>';
            allEffects.forEach(function (e) {
                const statusBadge = e.isMissing ? '<span class="comp-badge badge-warning">Missing</span>' : '<span class="comp-badge badge-root">Installed</span>';
                html += `<tr>
                    <td style="font-weight: 500;">${escapeHtml(e.name)}</td>
                    <td style="color: var(--text-muted); font-family: var(--font-mono); font-size: 10px;">${escapeHtml(e.matchName || '-')}</td>
                    <td>${e.count}</td>
                    <td>${statusBadge}</td>
                </tr>`;
            });
            html += '</tbody></table>';
            elements.auditorAllEffectsList.innerHTML = html;
        }

        // Bind reveal buttons
        const revealBtns = elements.auditorModal.querySelectorAll('.auditor-reveal-btn');
        revealBtns.forEach(function (btn) {
            btn.addEventListener('click', async function () {
                const compId = parseInt(this.getAttribute('data-comp-id'), 10);
                const layerIndex = parseInt(this.getAttribute('data-layer-index'), 10);
                try {
                    const res = await AEBridge.revealLayerInComp(compId, layerIndex);
                    if (res.success) {
                        const name = res.data && res.data.layerName ? res.data.layerName : 'Layer';
                        if (typeof ToastSystem !== 'undefined') ToastSystem.success(_t('toasts.layerRevealed', { layer: name }, `Revealed '${name}' in AE.`));
                    } else {
                        if (typeof ToastSystem !== 'undefined') ToastSystem.error(res.error ? res.error.message : 'Reveal failed');
                    }
                } catch (err) {
                    if (typeof ToastSystem !== 'undefined') ToastSystem.error('Reveal Error: ' + err.message);
                }
            });
        });
    }

    function openAuditorModal() {
        if (elements.auditorModal) {
            elements.auditorModal.classList.add('active');
        }
    }

    function closeAuditorModal() {
        if (elements.auditorModal) {
            elements.auditorModal.classList.remove('active');
        }
    }

    // =========================================================================
    // 3.2 ORPHAN CLEANER LOGIC
    // =========================================================================

    /**
     * Run Deep Orphan Audit
     */
    async function runOrphanScan() {
        if (!elements.btnRunOrphanScan) return;

        try {
            elements.btnRunOrphanScan.disabled = true;
            elements.btnRunOrphanScan.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + _t('common.scan', null, 'Analyzing...');

            const response = await AEBridge.deepOrphanAudit();
            if (response.success && response.data) {
                latestOrphanAudit = response.data;
                const stats = latestOrphanAudit.stats || {};

                // Update Badges
                if (elements.badgeRoots) elements.badgeRoots.textContent = (stats.rootCount || 0) + ' ' + _t('smart.badgeRootComps', null, 'Root');
                if (elements.badgeOrphans) elements.badgeOrphans.textContent = (stats.orphanCount || 0) + ' ' + _t('smart.badgeOrphanComps', null, 'Orphan');
                if (elements.badgeEmptyComps) elements.badgeEmptyComps.textContent = (stats.emptyCount || 0) + ' ' + _t('smart.badgeEmptyComps', null, 'Empty');

                const orphanComps = latestOrphanAudit.orphanComps || [];
                const unusedFootage = latestOrphanAudit.unusedFootage || [];

                if (elements.btnIsolateOrphansAction) {
                    elements.btnIsolateOrphansAction.disabled = (orphanComps.length === 0);
                }
                if (elements.btnCleanOrphansAction) {
                    elements.btnCleanOrphansAction.disabled = (orphanComps.length === 0 && unusedFootage.length === 0);
                }

                renderOrphanModal(latestOrphanAudit);

                if (typeof ToastSystem !== 'undefined') {
                    ToastSystem.info(`Dependency Scan: ${orphanComps.length} orphan comps, ${unusedFootage.length} unused assets.`);
                }
            } else {
                const msg = response.error ? response.error.message : 'Scan Failed';
                if (typeof ToastSystem !== 'undefined') ToastSystem.error(msg);
            }
        } catch (e) {
            if (typeof ToastSystem !== 'undefined') ToastSystem.error('Orphan Scan Error: ' + e.message);
        } finally {
            elements.btnRunOrphanScan.disabled = false;
            elements.btnRunOrphanScan.innerHTML = '<i class="fa-solid fa-network-wired"></i> ' + _t('smart.btnRunOrphanScan', null, 'Analyze Dependencies');
        }
    }

    /**
     * Render Orphan Details inside Modal
     */
    function renderOrphanModal(data) {
        const orphanComps = data.orphanComps || [];
        const unusedFootage = data.unusedFootage || [];

        if (elements.orphanCompsList) {
            if (orphanComps.length === 0) {
                elements.orphanCompsList.innerHTML = '<div style="padding: 10px; text-align: center; color: var(--text-muted); font-size: 11px;">' + _t('smart.noOrphansDetected', null, 'No orphan compositions detected.') + '</div>';
            } else {
                let html = '';
                orphanComps.forEach(function (c) {
                    html += `<div class="rename-preview-row">
                        <label style="display: flex; align-items: center; gap: 6px; flex: 1; cursor: pointer;">
                            <input type="checkbox" class="orphan-comp-checkbox" value="${c.id}" checked style="accent-color: var(--accent);" />
                            <i class="fa-solid fa-film" style="color: #ba68c8;"></i>
                            <span class="rename-new-name">${escapeHtml(c.name)}</span>
                        </label>
                        <span style="font-size: 10px; color: var(--text-muted);">${escapeHtml(c.reason || '')}</span>
                    </div>`;
                });
                elements.orphanCompsList.innerHTML = html;
            }
        }

        if (elements.orphanFootageList) {
            if (unusedFootage.length === 0) {
                elements.orphanFootageList.innerHTML = '<div style="padding: 10px; text-align: center; color: var(--text-muted); font-size: 11px;">' + _t('smart.noUnusedMediaFound', null, 'No unreferenced media found.') + '</div>';
            } else {
                let html = '';
                unusedFootage.forEach(function (f) {
                    html += `<div class="rename-preview-row">
                        <label style="display: flex; align-items: center; gap: 6px; flex: 1; cursor: pointer;">
                            <input type="checkbox" class="orphan-footage-checkbox" value="${f.id}" checked style="accent-color: var(--accent);" />
                            <i class="fa-solid fa-file" style="color: var(--accent);"></i>
                            <span class="rename-new-name">${escapeHtml(f.name)}</span>
                        </label>
                        <span style="font-size: 10px; color: var(--text-muted);">${formatBytes(f.size || 0)}</span>
                    </div>`;
                });
                elements.orphanFootageList.innerHTML = html;
            }
        }
    }

    /**
     * Isolate Orphan Comps into a folder
     */
    async function isolateOrphanCompsAction() {
        try {
            const response = await AEBridge.isolateOrphanComps();
            if (response.success) {
                const count = response.data ? response.data.isolatedCount : 0;
                if (typeof ToastSystem !== 'undefined') ToastSystem.success(`Isolated ${count} orphan comp(s) into [ Orphan Comps ] bin.`);
                runOrphanScan();
            } else {
                if (typeof ToastSystem !== 'undefined') ToastSystem.error(response.error ? response.error.message : 'Isolate failed');
            }
        } catch (e) {
            if (typeof ToastSystem !== 'undefined') ToastSystem.error('Isolate Error: ' + e.message);
        }
    }

    /**
     * Delete Orphan Items Confirm Action
     */
    async function executeOrphanDelete() {
        if (!elements.orphanModal) return;

        const checkedComps = Array.from(elements.orphanModal.querySelectorAll('.orphan-comp-checkbox:checked')).map(cb => parseInt(cb.value, 10));
        const checkedFootage = Array.from(elements.orphanModal.querySelectorAll('.orphan-footage-checkbox:checked')).map(cb => parseInt(cb.value, 10));

        if (checkedComps.length === 0 && checkedFootage.length === 0) {
            if (typeof ToastSystem !== 'undefined') ToastSystem.warning('Please select at least one item to delete.');
            return;
        }

        try {
            const res = await AEBridge.removeOrphanItems({
                compIds: checkedComps,
                footageIds: checkedFootage
            });

            if (res.success) {
                const total = res.data ? res.data.totalRemoved : 0;
                if (typeof ToastSystem !== 'undefined') ToastSystem.success(`Removed ${total} orphan item(s) from project.`);
                elements.orphanModal.classList.remove('active');
                runOrphanScan();
            } else {
                if (typeof ToastSystem !== 'undefined') ToastSystem.error(res.error ? res.error.message : 'Delete failed');
            }
        } catch (e) {
            if (typeof ToastSystem !== 'undefined') ToastSystem.error('Delete Error: ' + e.message);
        }
    }

    // =========================================================================
    // 3.3 SMART RELINK LOGIC
    // =========================================================================

    /**
     * Browse search folder for Smart Relink
     */
    async function browseRelinkFolder() {
        try {
            const folder = await CEPBridge.openFolderPicker('Select Directory to Relink Missing Media');
            if (folder && elements.relinkFolderInput) {
                elements.relinkFolderInput.value = folder;
            }
        } catch (e) { }
    }

    /**
     * Execute Smart Auto-Relink
     */
    async function executeRelink() {
        if (!elements.relinkFolderInput || !elements.btnExecuteRelink) return;
        const folderPath = elements.relinkFolderInput.value.trim();

        if (!folderPath) {
            if (typeof ToastSystem !== 'undefined') ToastSystem.warning('Please select a search folder first.');
            return;
        }

        const recursive = elements.relinkRecursiveCheck ? elements.relinkRecursiveCheck.checked : true;

        try {
            elements.btnExecuteRelink.disabled = true;
            elements.btnExecuteRelink.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + _t('common.scan', null, 'Relinking...');

            const response = await AEBridge.autoRelinkMedia(folderPath, recursive);

            if (response.success && response.data) {
                const data = response.data;
                const relinked = data.relinkedCount || 0;
                const remaining = data.remainingMissing || 0;

                if (elements.badgeMissingFiles) {
                    elements.badgeMissingFiles.textContent = remaining + ' ' + _t('smart.badgeMissingEffects', null, 'Missing');
                    elements.badgeMissingFiles.className = remaining > 0 ? 'comp-badge badge-warning' : 'comp-badge badge-root';
                }

                if (elements.relinkResultMsg) {
                    elements.relinkResultMsg.style.display = 'block';
                    elements.relinkResultMsg.style.background = relinked > 0 ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 152, 0, 0.15)';
                    elements.relinkResultMsg.style.color = relinked > 0 ? '#4CAF50' : '#FF9800';
                    elements.relinkResultMsg.innerHTML = `<i class="fa-solid fa-circle-check"></i> Relinked <strong>${relinked}</strong> files successfully. (Remaining missing: ${remaining})`;
                }

                if (typeof ToastSystem !== 'undefined') {
                    if (relinked > 0) ToastSystem.success(_t('toasts.relinkSuccess', { count: relinked }, `Relinked ${relinked} files!`));
                    else ToastSystem.info('No matching filenames found in folder.');
                }
            } else {
                const msg = response.error ? response.error.message : 'Relink failed';
                if (typeof ToastSystem !== 'undefined') ToastSystem.error(msg);
            }
        } catch (e) {
            if (typeof ToastSystem !== 'undefined') ToastSystem.error('Relink Error: ' + e.message);
        } finally {
            elements.btnExecuteRelink.disabled = false;
            elements.btnExecuteRelink.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> ' + _t('smart.btnRunRelink', null, 'Start Auto-Relink');
        }
    }

    // =========================================================================
    // 3.4 SMART COLLECT LOGIC
    // =========================================================================

    /**
     * Browse target folder for Smart Collect
     */
    async function browseCollectFolder() {
        try {
            const folder = await CEPBridge.openFolderPicker('Select Destination Folder for Collected Media');
            if (folder && elements.collectFolderInput) {
                elements.collectFolderInput.value = folder;
            }
        } catch (e) { }
    }

    /**
     * Execute Smart Collect
     */
    async function executeCollect() {
        if (!elements.collectFolderInput || !elements.btnExecuteCollect) return;
        const targetPath = elements.collectFolderInput.value.trim();

        if (!targetPath) {
            if (typeof ToastSystem !== 'undefined') ToastSystem.warning('Please select a destination folder first.');
            return;
        }

        const options = {
            targetFolder: targetPath,
            usedOnly: elements.collectUsedOnlyCheck ? elements.collectUsedOnlyCheck.checked : true,
            organizeByType: elements.collectOrganizeTypesCheck ? elements.collectOrganizeTypesCheck.checked : true,
            relinkProject: elements.collectRelinkCheck ? elements.collectRelinkCheck.checked : false,
            saveProjectCopy: elements.collectSaveAepCheck ? elements.collectSaveAepCheck.checked : true
        };

        try {
            elements.btnExecuteCollect.disabled = true;
            elements.btnExecuteCollect.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + _t('common.scan', null, 'Collecting...');

            const response = await AEBridge.smartCollectMedia(options);

            if (response.success && response.data) {
                const data = response.data;
                const collected = data.collectedCount || 0;
                const bytes = formatBytes(data.totalBytes || 0);

                if (elements.collectResultMsg) {
                    elements.collectResultMsg.style.display = 'block';
                    elements.collectResultMsg.style.background = 'rgba(76, 175, 80, 0.15)';
                    elements.collectResultMsg.style.color = '#4CAF50';
                    elements.collectResultMsg.innerHTML = `<i class="fa-solid fa-circle-check"></i> Consolidated <strong>${collected}</strong> files (${bytes}) into: <br/><code style="font-size: 10px; color: var(--accent);">${escapeHtml(data.targetFolder)}</code>`;
                }

                if (typeof ToastSystem !== 'undefined') {
                    ToastSystem.success(_t('toasts.collectSuccess', { count: collected, bytes: bytes }, `Consolidated ${collected} files!`));
                }
            } else {
                const msg = response.error ? response.error.message : 'Collect failed';
                if (typeof ToastSystem !== 'undefined') ToastSystem.error(msg);
            }
        } catch (e) {
            if (typeof ToastSystem !== 'undefined') ToastSystem.error('Collect Error: ' + e.message);
        } finally {
            elements.btnExecuteCollect.disabled = false;
            elements.btnExecuteCollect.innerHTML = '<i class="fa-solid fa-download"></i> ' + _t('smart.btnRunCollect', null, 'Collect Project Assets');
        }
    }

    // =========================================================================
    // HELPERS & BINDING
    // =========================================================================

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Bind UI events
     */
    function bindEvents() {
        if (elements.btnIsolateMissing) {
            elements.btnIsolateMissing.addEventListener('click', function () {
                EventBus.emit(Events.ISOLATE_MISSING_CLICKED);
            });
        }
        if (elements.btnIsolateUnused) {
            elements.btnIsolateUnused.addEventListener('click', function () {
                EventBus.emit(Events.ISOLATE_UNUSED_CLICKED);
            });
        }
        if (elements.btnRemoveUnused) {
            elements.btnRemoveUnused.addEventListener('click', function () {
                EventBus.emit(Events.REMOVE_UNUSED_CLICKED);
            });
        }
        if (elements.btnPurgeCache) {
            elements.btnPurgeCache.addEventListener('click', async function () {
                try {
                    const res = await AEBridge.purgeCaches();
                    if (res.success && typeof ToastSystem !== 'undefined') {
                        ToastSystem.success(_t('toasts.purgedCaches', null, 'All Caches Purged'));
                    }
                } catch (e) { }
            });
        }

        // Auditor Events
        if (elements.btnRunAuditor) elements.btnRunAuditor.addEventListener('click', runAuditor);
        if (elements.btnViewAuditReport) elements.btnViewAuditReport.addEventListener('click', openAuditorModal);
        if (elements.auditorCloseTop) elements.auditorCloseTop.addEventListener('click', closeAuditorModal);
        if (elements.auditorCloseBtn) elements.auditorCloseBtn.addEventListener('click', closeAuditorModal);

        // Auditor Modal Sub-tab switching
        const subtabBtns = document.querySelectorAll('.auditor-subtab-btn');
        subtabBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                subtabBtns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');

                const targetTabId = this.getAttribute('data-tab');
                const panels = document.querySelectorAll('.auditor-subtab-panel');
                panels.forEach(p => p.style.display = 'none');

                const activePanel = document.getElementById(targetTabId);
                if (activePanel) activePanel.style.display = 'block';
            });
        });

        // Orphan Events
        if (elements.btnRunOrphanScan) elements.btnRunOrphanScan.addEventListener('click', runOrphanScan);
        if (elements.btnIsolateOrphansAction) elements.btnIsolateOrphansAction.addEventListener('click', isolateOrphanCompsAction);
        if (elements.btnCleanOrphansAction) {
            elements.btnCleanOrphansAction.addEventListener('click', function () {
                if (elements.orphanModal) elements.orphanModal.classList.add('active');
            });
        }
        if (elements.orphanCloseTop) {
            elements.orphanCloseTop.addEventListener('click', function () {
                if (elements.orphanModal) elements.orphanModal.classList.remove('active');
            });
        }
        if (elements.orphanCancelBtn) {
            elements.orphanCancelBtn.addEventListener('click', function () {
                if (elements.orphanModal) elements.orphanModal.classList.remove('active');
            });
        }
        if (elements.orphanModalIsolateBtn) {
            elements.orphanModalIsolateBtn.addEventListener('click', function () {
                isolateOrphanCompsAction();
                if (elements.orphanModal) elements.orphanModal.classList.remove('active');
            });
        }
        if (elements.orphanModalDeleteBtn) {
            elements.orphanModalDeleteBtn.addEventListener('click', executeOrphanDelete);
        }

        // Relink Events
        if (elements.btnRelinkBrowse) elements.btnRelinkBrowse.addEventListener('click', browseRelinkFolder);
        if (elements.btnExecuteRelink) elements.btnExecuteRelink.addEventListener('click', executeRelink);

        // Collect Events
        if (elements.btnCollectBrowse) elements.btnCollectBrowse.addEventListener('click', browseCollectFolder);
        if (elements.btnExecuteCollect) elements.btnExecuteCollect.addEventListener('click', executeCollect);
    }

    // Public API
    return {
        init: function () {
            cacheElements();
            bindEvents();
        },
        runAuditor: runAuditor,
        runOrphanScan: runOrphanScan
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SmartController;
}
