/**
 * MediaFlow - Comp Tree UI Controller
 * Handles rendering the interactive composition tree, search,
 * and batch selection actions.
 * Version: 1.0
 */

const CompTreeUI = (function () {
    'use strict';

    let treeData = null;
    let selectedIds = new Set();
    let isExpanded = false;

    // DOM Elements
    let containerElem, searchInput, refreshBtn, expandBtn, renderBtn, renderTopBtn, actionsBar, selectedCountElem;
    let renameBtn, renameBottomBtn;
    let renderModal, renderTemplateSelect, renderOutputFolder, renderStartImmediately, renderModalConfirm, renderModalCancel, renderCompCountBadge;

    /**
     * Initialize the Comp Tree UI
     */
    function init() {
        containerElem = document.getElementById('comp-tree-container');
        searchInput = document.getElementById('comp-tree-search');
        refreshBtn = document.getElementById('btn-comptree-refresh');
        expandBtn = document.getElementById('btn-comptree-expand');
        renderBtn = document.getElementById('btn-comptree-render');
        renderTopBtn = document.getElementById('btn-comptree-render-selected');
        actionsBar = document.getElementById('comp-tree-actions');
        selectedCountElem = document.getElementById('comp-tree-selected-count');
        renameBtn = document.getElementById('btn-comptree-rename');
        renameBottomBtn = document.getElementById('btn-comptree-rename-bottom');
        renderModal = document.getElementById('render-options-modal');
        renderTemplateSelect = document.getElementById('render-template-select');
        renderOutputFolder = document.getElementById('render-output-folder');
        renderStartImmediately = document.getElementById('render-start-immediately');
        renderModalConfirm = document.getElementById('render-modal-confirm-btn');
        renderModalCancel = document.getElementById('render-modal-cancel-btn');
        renderCompCountBadge = document.getElementById('render-comp-count-badge');

        if (!containerElem) return;

        bindEvents();
    }

    /**
     * Bind UI and EventBus events
     */
    function bindEvents() {
        // Toolbar buttons
        if (refreshBtn) refreshBtn.addEventListener('click', loadTree);

        if (expandBtn) {
            expandBtn.addEventListener('click', function () {
                isExpanded = !isExpanded;
                toggleAllNodes(isExpanded);
                var icon = expandBtn.querySelector('i');
                if (icon) {
                    icon.className = isExpanded ? 'fa-solid fa-compress' : 'fa-solid fa-list';
                }
            });
        }

        function openRenderModal() {
            var ids = Array.from(selectedIds);
            if (ids.length === 0) return;
            if (renderModal) {
                if (renderCompCountBadge) renderCompCountBadge.textContent = ids.length;
                renderModal.classList.add('active');
            } else {
                EventBus.emit(Events.COMP_TREE_RENDER_SELECTED, ids);
            }
        }

        if (renderBtn) renderBtn.addEventListener('click', openRenderModal);
        if (renderTopBtn) renderTopBtn.addEventListener('click', openRenderModal);

        if (renderModalCancel) {
            renderModalCancel.addEventListener('click', function () {
                if (renderModal) renderModal.classList.remove('active');
            });
        }

        if (renderModalConfirm) {
            renderModalConfirm.addEventListener('click', async function () {
                var ids = Array.from(selectedIds);
                if (ids.length === 0) return;
                if (renderModal) renderModal.classList.remove('active');

                var options = {
                    template: renderTemplateSelect ? renderTemplateSelect.value : null,
                    outputFolder: renderOutputFolder ? renderOutputFolder.value.trim() : null,
                    startRender: renderStartImmediately ? renderStartImmediately.checked : false
                };

                UIController.log('Adding ' + ids.length + ' comps to Render Queue...', 'info');
                UIController.setProcessing(true);
                try {
                    const response = await AEBridge.addCompsToRenderQueue(ids, options);
                    UIController.setProcessing(false);
                    if (response.success && response.data) {
                        var msg = 'Added ' + response.data.addedCount + ' comps to Render Queue';
                        if (response.data.rendered) msg += ' and started render!';
                        UIController.log(msg, 'success');
                        if (typeof ToastManager !== 'undefined') ToastManager.show(msg, 'success');
                        clearSelection();
                    } else {
                        var err = (response.error && response.error.message) || 'Unknown error';
                        UIController.log('Render queue failed: ' + err, 'error');
                        if (typeof ToastManager !== 'undefined') ToastManager.show(((typeof I18N !== 'undefined' && I18N.getLanguage() === 'ar') ? 'فشل الإرسال للرندر: ' : 'Failed to send to Render Queue: ') + err, 'error');
                    }
                } catch (e) {
                    UIController.setProcessing(false);
                    UIController.log('Render error: ' + e.message, 'error');
                }
            });
        }

        function triggerBatchRename() {
            var selectedData = getSelectedCompsData();
            if (selectedData.length === 0) {
                if (typeof ToastManager !== 'undefined') ToastManager.show(((typeof I18N !== 'undefined' && I18N.getLanguage() === 'ar') ? 'يرجى تحديد كومبوزيشن واحدة على الأقل للتسمية' : 'Please select at least one composition to rename'), 'warning');
                return;
            }
            if (typeof BatchRenamer !== 'undefined') {
                BatchRenamer.show(selectedData);
            }
        }

        if (renameBtn) renameBtn.addEventListener('click', triggerBatchRename);
        if (renameBottomBtn) renameBottomBtn.addEventListener('click', triggerBatchRename);

        // Search
        if (searchInput) {
            searchInput.addEventListener('input', function (e) {
                filterTree(e.target.value.toLowerCase().trim());
            });
        }

        // Auto-refresh when tab is opened for the first time
        EventBus.on(Events.TAB_CHANGED, function (data) {
            if (data.tab === 'comptree' && !treeData) {
                loadTree();
            }
        });

        EventBus.on(Events.COMP_TREE_REFRESH, loadTree);

        EventBus.on('LANGUAGE_CHANGED', function () {
            if (treeData) {
                renderTree(treeData);
            }
        });
    }

    /**
     * Load tree data from ExtendScript
     */
    async function loadTree() {
        if (!containerElem) return;

        UIController.log('Scanning compositions...', 'info');
        containerElem.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i><br>' + _t('compTree.loadingTree', null, 'Loading tree...') + '</div>';

        try {
            const response = await AEBridge.getCompTree();
            if (response.success && response.data) {
                treeData = response.data.roots || [];
                selectedIds.clear();
                updateSelectionUI();
                renderTree();

                var total = response.data.totalComps || 0;
                UIController.log(`Found ${total} compositions`, 'success');
            } else {
                showError(response.error ? response.error.message : 'Failed to load composition tree');
            }
        } catch (e) {
            showError(e.message);
        }
    }

    function showError(msg) {
        if (containerElem) {
            containerElem.innerHTML = `<div class="empty-state" style="color: var(--danger)"><i class="fa-solid fa-triangle-exclamation" style="font-size: 32px; margin-bottom: 10px;"></i><br>${msg}</div>`;
        }
        UIController.log('Tree Error: ' + msg, 'error');
    }

    /**
     * Render the tree HTML structure
     */
    function renderTree() {
        if (!treeData || treeData.length === 0) {
            containerElem.innerHTML = '<div class="empty-state"><i class="fa-solid fa-folder-open"></i><br>' + _t('compTree.emptyTreeMessage', null, 'No active compositions found in project.') + '</div>';
            return;
        }

        var wrapper = document.createElement('div');
        wrapper.className = 'comp-tree';

        treeData.forEach(function (rootNode) {
            wrapper.appendChild(createNodeHTML(rootNode, 0));
        });

        containerElem.innerHTML = '';
        containerElem.appendChild(wrapper);
    }

    /**
     * Create HTML for a single node and its children
     */
    function createNodeHTML(node, depth) {
        var nodeWrapper = document.createElement('div');
        nodeWrapper.className = 'tree-item-wrapper';
        nodeWrapper.dataset.id = node.id;
        nodeWrapper.dataset.name = node.name.toLowerCase();

        var hasChildren = node.children && node.children.length > 0;

        var nodeLine = document.createElement('div');
        nodeLine.className = 'tree-node' + (node.isRoot ? ' root-node' : '');
        nodeLine.style.paddingLeft = (depth * 20) + 'px';

        // Toggle arrow
        var toggle = document.createElement('span');
        toggle.className = 'tree-toggle ' + (hasChildren ? '' : 'hidden');
        toggle.innerHTML = isExpanded ? '<i class="fa-solid fa-chevron-down"></i>' : '<i class="fa-solid fa-chevron-right"></i>';
        nodeLine.appendChild(toggle);

        // Checkbox
        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'tree-checkbox';
        checkbox.dataset.id = node.id;
        checkbox.checked = selectedIds.has(node.id);
        nodeLine.appendChild(checkbox);

        // Icon
        var icon = document.createElement('i');
        icon.className = 'fa-solid fa-film tree-icon';
        if (node.isRoot) icon.style.color = 'var(--accent)';
        nodeLine.appendChild(icon);

        // Name
        var nameSpan = document.createElement('span');
        nameSpan.className = 'tree-name';
        nameSpan.textContent = node.name;
        nodeLine.appendChild(nameSpan);

        // Meta badges
        var metaSpan = document.createElement('span');
        metaSpan.className = 'tree-meta';

        var audioIcon = node.hasAudio ? '<i class="fa-solid fa-volume-high" style="color: var(--text-muted); font-size: 10px; margin-right: 5px;" title="Has Audio"></i>' : '';

        var statusBadgeHtml = '';
        if (node.hasMissing) {
            statusBadgeHtml = '<span class="comp-badge badge-warning" title="Contains Missing Footage"><i class="fa-solid fa-triangle-exclamation"></i> ' + _t('compTree.badgeMissing', null, 'Missing') + '</span>';
        } else if (node.isEmpty) {
            statusBadgeHtml = '<span class="comp-badge badge-empty" title="Empty Comp (0 layers)"><i class="fa-solid fa-circle-notch"></i> ' + _t('compTree.badgeEmpty', null, 'Empty') + '</span>';
        }

        var rootBadgeHtml = node.isRoot 
            ? '<span class="comp-badge badge-root" title="Root Composition"><i class="fa-solid fa-crown"></i> ' + _t('compTree.badgeRoot', null, 'Root') + '</span>'
            : '<span class="comp-badge badge-sub" title="Pre-comp / Sub"><i class="fa-solid fa-sitemap"></i> ' + _t('compTree.badgeSub', null, 'Sub') + '</span>';

        metaSpan.innerHTML = `
            ${statusBadgeHtml}
            ${rootBadgeHtml}
            ${audioIcon}
            <span class="tree-badge" title="${node.numLayers} Layers"><i class="fa-solid fa-layer-group" style="opacity: 0.6; margin-right: 3px;"></i>${node.numLayers}</span>
            <span class="tree-badge">${node.duration}s</span>
            <span class="tree-badge">${node.frameRate}fps</span>
            <span class="tree-badge">${node.width}x${node.height}</span>
        `;
        nodeLine.appendChild(metaSpan);

        // Actions
        var actionsSpan = document.createElement('span');
        actionsSpan.className = 'tree-node-actions';
        actionsSpan.innerHTML = `
            <button class="node-action-btn tooltipped tooltip-bottom" data-i18n-tooltip="compTree.revealInProject" data-tooltip="Reveal in Project" data-action="reveal">
                <i class="fa-solid fa-folder-tree"></i>
            </button>
            <button class="node-action-btn tooltipped tooltip-bottom" data-i18n-tooltip="compTree.openInTimeline" data-tooltip="Open in Timeline" data-action="open">
                <i class="fa-solid fa-timeline"></i>
            </button>
            <button class="node-action-btn tooltipped tooltip-bottom" data-i18n-tooltip="compTree.addToRenderQueue" data-tooltip="Add to Render Queue" data-action="render">
                <i class="fa-solid fa-film"></i>
            </button>
        `;
        nodeLine.appendChild(actionsSpan);

        nodeWrapper.appendChild(nodeLine);

        // Children container
        var childrenContainer = null;
        if (hasChildren) {
            childrenContainer = document.createElement('div');
            childrenContainer.className = 'tree-children' + (isExpanded ? ' expanded' : '');
            node.children.forEach(function (childNode) {
                childrenContainer.appendChild(createNodeHTML(childNode, depth + 1));
            });
            nodeWrapper.appendChild(childrenContainer);
        }

        // Event Listeners
        toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            if (childrenContainer) {
                var isExp = childrenContainer.classList.toggle('expanded');
                toggle.innerHTML = isExp ? '<i class="fa-solid fa-chevron-down"></i>' : '<i class="fa-solid fa-chevron-right"></i>';
            }
        });

        checkbox.addEventListener('change', function (e) {
            e.stopPropagation();
            var modeElem = document.querySelector('input[name="comp-select-mode"]:checked');
            var isRecursive = modeElem ? modeElem.value === 'recursive' : true;
            handleSelection(node, checkbox.checked, isRecursive);
            updateSelectionUI();
        });

        nodeLine.addEventListener('click', function (e) {
            // Ignore if clicking on other interactive elements
            if (e.target.closest('.tree-toggle') || e.target.closest('.tree-checkbox') || e.target.closest('.node-action-btn')) {
                return;
            }
            checkbox.checked = !checkbox.checked;
            var modeElem = document.querySelector('input[name="comp-select-mode"]:checked');
            var isRecursive = modeElem ? modeElem.value === 'recursive' : true;
            handleSelection(node, checkbox.checked, isRecursive);
            updateSelectionUI();
        });

        // Action Buttons Events
        var revealBtn = actionsSpan.querySelector('[data-action="reveal"]');
        var openBtn = actionsSpan.querySelector('[data-action="open"]');

        if (revealBtn) {
            revealBtn.addEventListener('click', async function (e) {
                e.stopPropagation();
                try {
                    UIController.setProcessing(true);
                    var res = await AEBridge.revealCompInProject(node.id);
                    if (!res.success) throw new Error(res.error ? res.error.message : 'Failed');
                } catch (err) {
                    UIController.log('Failed to reveal comp: ' + err.message, 'error');
                } finally {
                    UIController.setProcessing(false);
                }
            });
        }

        if (openBtn) {
            openBtn.addEventListener('click', async function (e) {
                e.stopPropagation();
                try {
                    UIController.setProcessing(true);
                    var res = await AEBridge.openCompInTimeline(node.id);
                    if (!res.success) throw new Error(res.error ? res.error.message : 'Failed');
                } catch (err) {
                    UIController.log('Failed to open comp: ' + err.message, 'error');
                } finally {
                    UIController.setProcessing(false);
                }
            });
        }

        var renderInlineBtn = actionsSpan.querySelector('[data-action="render"]');
        if (renderInlineBtn) {
            renderInlineBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                // Send just this one node
                EventBus.emit(Events.COMP_TREE_RENDER_SELECTED, [node.id]);
            });
        }

        return nodeWrapper;
    }

    /**
     * Recursively update selection state for a node and its children (if isRecursive is true)
     */
    function handleSelection(node, isSelected, isRecursive) {
        if (isSelected) {
            selectedIds.add(node.id);
        } else {
            selectedIds.delete(node.id);
        }

        // Sync DOM checkbox
        var cb = containerElem.querySelector('input.tree-checkbox[data-id="' + node.id + '"]');
        if (cb) cb.checked = isSelected;

        // Propagate to children
        if (isRecursive && node.children) {
            node.children.forEach(function (child) {
                handleSelection(child, isSelected, isRecursive);
            });
        }
    }

    /**
     * Update the floating action bar
     */
    function updateSelectionUI() {
        if (!actionsBar || !selectedCountElem) return;

        var count = selectedIds.size;
        selectedCountElem.textContent = _t('compTree.selectedCount', { count: count }, count + ' Selected');

        var canAct = count > 0;
        var btnOpacity = canAct ? '1' : '0.4';
        var btnCursor = canAct ? 'pointer' : 'not-allowed';

        if (renderBtn) { renderBtn.disabled = !canAct; renderBtn.style.opacity = btnOpacity; renderBtn.style.cursor = btnCursor; }
        if (renderTopBtn) { renderTopBtn.disabled = !canAct; renderTopBtn.style.opacity = btnOpacity; renderTopBtn.style.cursor = btnCursor; }
        if (renameBtn) { renameBtn.disabled = !canAct; renameBtn.style.opacity = btnOpacity; renameBtn.style.cursor = btnCursor; }
        if (renameBottomBtn) { renameBottomBtn.disabled = !canAct; renameBottomBtn.style.opacity = btnOpacity; renameBottomBtn.style.cursor = btnCursor; }
    }

    /**
     * Filter the tree by text
     */
    function filterTree(query) {
        if (!containerElem) return;

        var wrappers = containerElem.querySelectorAll('.tree-item-wrapper');
        if (!query) {
            // Reset
            wrappers.forEach(w => {
                w.style.display = 'block';
                var children = w.querySelector('.tree-children');
                if (children) {
                    if (isExpanded) children.classList.add('expanded');
                    else children.classList.remove('expanded');
                }
            });
            return;
        }

        // Hide all initially
        wrappers.forEach(w => { w.style.display = 'none'; w.dataset.match = 'false'; });

        // Find matches and show ancestors
        wrappers.forEach(w => {
            var name = w.dataset.name || '';
            if (name.includes(query)) {
                w.style.display = 'block';
                w.dataset.match = 'true';

                // Show all ancestors
                var parent = w.parentElement;
                while (parent && parent.id !== 'comp-tree-container') {
                    if (parent.classList.contains('tree-children')) {
                        parent.classList.add('expanded'); // Auto expand
                    } else if (parent.classList.contains('tree-item-wrapper')) {
                        parent.style.display = 'block';
                    }
                    parent = parent.parentElement;
                }
            }
        });
    }

    /**
     * Toggle all nodes expand/collapse
     */
    function toggleAllNodes(expand) {
        if (!containerElem) return;
        var childrenDivs = containerElem.querySelectorAll('.tree-children');
        var toggles = containerElem.querySelectorAll('.tree-toggle');

        childrenDivs.forEach(div => {
            if (expand) div.classList.add('expanded');
            else div.classList.remove('expanded');
        });

        toggles.forEach(t => {
            if (!t.classList.contains('hidden')) {
                t.innerHTML = expand ? '<i class="fa-solid fa-chevron-down"></i>' : '<i class="fa-solid fa-chevron-right"></i>';
            }
        });
    }

    /**
     * Clear current selection
     */
    function clearSelection() {
        selectedIds.clear();
        if (containerElem) {
            var checkboxes = containerElem.querySelectorAll('.tree-checkbox');
            checkboxes.forEach(cb => cb.checked = false);
        }
        updateSelectionUI();
    }

    /**
     * Collect full node data for all currently selected compositions
     * @returns {Array<object>}
     */
    function getSelectedCompsData() {
        var list = [];
        var added = {};
        function traverse(node) {
            if (selectedIds.has(node.id) && !added[node.id]) {
                added[node.id] = true;
                list.push({
                    id: node.id,
                    name: node.name,
                    width: node.width,
                    height: node.height,
                    frameRate: node.frameRate,
                    duration: node.duration,
                    hasMissing: node.hasMissing
                });
            }
            if (node.children) {
                node.children.forEach(traverse);
            }
        }
        if (treeData && treeData.roots) {
            treeData.roots.forEach(traverse);
        }
        return list;
    }

    return {
        init: init,
        getSelectedCompsData: getSelectedCompsData,
        loadTree: loadTree,
        clearSelection: clearSelection
    };

})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CompTreeUI;
}
