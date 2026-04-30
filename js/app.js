/* ============================================================
   app.js - AI Tagger 主应用逻辑
   动作卡片管理、任务列表、模板栏、执行引擎
   ============================================================ */

const App = {
    _actions: [],
    _taskItems: [],
    _running: false,
    /** 执行时的临时系统提示词（由 system 动作设置） */
    _tempSystemPrompt: null,

    // ========== 动作类型配置（已移除"综合分析"） ==========
    _actionTypes: {
        description: {
            label: '描述生成',
            icon: '📝',
            iconClass: 'icon-desc',
            color: '#4a9eff',
        },
        tags: {
            label: '标签生成',
            icon: '🏷️',
            iconClass: 'icon-tags',
            color: '#34d399',
        },
        rating: {
            label: '质量评分',
            icon: '⭐',
            iconClass: 'icon-rating',
            color: '#fbbf24',
        },
        system: {
            label: '系统提示词',
            icon: '🔧',
            iconClass: 'icon-system',
            color: '#9ca3af',
        },
        folder: {
            label: '文件夹分析',
            icon: '📊',
            iconClass: 'icon-folder',
            color: '#2dd4bf',
        },
        rename: {
            label: '智能重命名',
            icon: '✏️',
            iconClass: 'icon-rename',
            color: '#f472b6',
        },
    },

    // ========== 初始化 ==========

    init() {
        this._renderActionPanel();
        this._renderTemplateBar();
        this._bindEvents();
    },

    async refreshSelection() {
        try {
            const count = await eagle.item.count({ isSelected: true });
            if (count > 0) {
                this._taskItems = await ItemService.getSelectedItems([
                    'id', 'name', 'ext', 'tags', 'annotation', 'star',
                    'size', 'thumbnailURL',
                ]);
            } else {
                this._taskItems = [];
            }
        } catch (e) {
            console.error('刷新选中失败:', e);
            this._taskItems = [];
        }
        this._renderTaskList();
    },

    // ========== 全局事件 ==========

    _bindEvents() {
        document.getElementById('btn-close')?.addEventListener('click', () => window.close());
        document.getElementById('btn-settings')?.addEventListener('click', () => this._openSettings());
        document.getElementById('btn-save-template')?.addEventListener('click', () => this._saveAsTemplate());
        document.getElementById('btn-load-template')?.addEventListener('click', () => this._loadTemplate());
        document.getElementById('btn-execute')?.addEventListener('click', () => this._executeAll());
    },

    // ========== 任务列表 ==========

    _renderTaskList() {
        const container = document.getElementById('task-list');
        const countEl = document.getElementById('task-count');
        if (!container) return;

        if (this._taskItems.length === 0) {
            container.innerHTML = `
                <div class="empty-hint">
                    <div class="empty-icon">📌</div>
                    <p>在 Eagle 中选择素材后<br/>将自动显示在此处</p>
                </div>`;
            if (countEl) countEl.textContent = '';
            return;
        }

        if (countEl) countEl.textContent = `${this._taskItems.length}`;

        let html = '';
        for (const item of this._taskItems) {
            const thumbUrl = item.thumbnailURL || '';
            const name = Utils.escapeHtml(item.name || '未知');
            const meta = (item.ext || '').toUpperCase();
            const status = item._status || 'pending';
            let statusIcon = '';
            switch (status) {
                case 'running': statusIcon = '<span class="task-status-icon running"><span class="spin">⟳</span></span>'; break;
                case 'done': statusIcon = '<span class="task-status-icon done">✓</span>'; break;
                case 'error': statusIcon = '<span class="task-status-icon error">✕</span>'; break;
                default: statusIcon = '<span class="task-status-icon pending">○</span>';
            }
            html += `
                <div class="task-item" data-id="${item.id}">
                    <img class="task-thumb" src="${thumbUrl}" onerror="this.style.display='none'" />
                    <div class="task-info">
                        <div class="task-name" title="${name}">${name}</div>
                        <div class="task-status">${meta}</div>
                    </div>
                    ${statusIcon}
                    <div class="task-progress ${status === 'running' ? 'active' : ''}" style="width:${item._progress || 0}%"></div>
                </div>`;
        }
        container.innerHTML = html;
    },

    _updateTaskItem(itemId, status, progress) {
        const item = this._taskItems.find((t) => t.id === itemId);
        if (item) { item._status = status; item._progress = progress || 0; }
        this._renderTaskList();
    },

    // ========== 动作面板 ==========

    _renderActionPanel() {
        const container = document.getElementById('action-list');
        const footer = document.getElementById('action-footer');
        const countEl = document.getElementById('action-count');

        if (this._actions.length === 0) {
            container.innerHTML = `
                <div class="action-list-empty">
                    <button class="btn-add-action" id="btn-add-first" title="添加动作">+</button>
                    <span class="hint-text">点击添加动作</span>
                </div>`;
            footer.classList.add('hidden');
            if (countEl) countEl.textContent = '';
            setTimeout(() => {
                const btn = document.getElementById('btn-add-first');
                if (btn) btn.addEventListener('click', () => this._showAddActionPopup());
            }, 50);
            return;
        }

        if (countEl) countEl.textContent = `${this._actions.length}`;
        footer.classList.remove('hidden');

        let html = '';
        for (let i = 0; i < this._actions.length; i++) {
            const action = this._actions[i];
            const typeCfg = this._actionTypes[action.type] || this._actionTypes.description;
            const isSystem = action.type === 'system';
            const isTags = action.type === 'tags';
            const isRating = action.type === 'rating';
            const isRename = action.type === 'rename';
            const isFolder = action.type === 'folder';

            html += `
            <div class="action-card" data-index="${i}">
                <div class="action-card-header">
                    <div class="action-type-icon ${typeCfg.iconClass}">${typeCfg.icon}</div>
                    <select class="action-type-select" data-index="${i}" onchange="App._onActionTypeChange(${i}, this.value)">
                        ${Object.entries(this._actionTypes).map(([k, v]) =>
                            `<option value="${k}" ${k === action.type ? 'selected' : ''}>${v.label}</option>`
                        ).join('')}
                    </select>
                    <button class="btn-card-remove" onclick="App._removeAction(${i})" title="移除">✕</button>
                </div>
                <div class="action-card-body">`;

            if (isSystem) {
                // 系统提示词动作：只有提示词输入框，没有指令
                html += `
                    <div class="card-field">
                        <label>系统提示词内容</label>
                        <textarea data-index="${i}" class="action-system-prompt" rows="3"
                            placeholder="例如：你是一个专业的视觉内容分析助手...">${Utils.escapeHtml(action.prompt || '')}</textarea>
                        <div class="help-text">此提示词将在执行时覆盖全局系统提示词，影响后续所有动作</div>
                    </div>`;
            } else {
                // 其他动作类型：有指令输入框
                html += `
                    <div class="card-field">
                        <label>指令</label>
                        <textarea data-index="${i}" class="action-instruction" rows="2"
                            placeholder="${this._getPlaceholder(action.type)}">${Utils.escapeHtml(action.instruction || '')}</textarea>
                    </div>`;
            }

            // 写入模式（描述、标签、评分）
            if (!isSystem && !isFolder && !isRename) {
                const modeOptions = isTags
                    ? [
                        { value: 'merge', label: '合并（保留旧标签 + 新标签）' },
                        { value: 'replace', label: '替换（清理旧标签 → 新标签）' },
                    ]
                    : isRating
                    ? [{ value: 'overwrite', label: '覆盖' }]
                    : [
                        { value: 'overwrite', label: '覆盖' },
                        { value: 'append', label: '追加' },
                    ];
                html += `
                    <div class="card-field">
                        <label>写入模式</label>
                        <select data-index="${i}" class="action-mode">
                            ${modeOptions.map((o) =>
                                `<option value="${o.value}" ${action.mode === o.value ? 'selected' : ''}>${o.label}</option>`
                            ).join('')}
                        </select>
                    </div>`;
            }

            // 排除标签（标签操作）
            if (isTags) {
                html += `
                    <div class="card-field">
                        <label>排除标签（逗号分隔，这些标签不被清理）</label>
                        <input type="text" data-index="${i}" class="action-exclude"
                            value="${Utils.escapeHtml((action.excludeTags || []).join(', '))}"
                            placeholder="例如：收藏, 重要" />
                    </div>`;
            }

            // 重命名模式
            if (isRename) {
                html += `
                    <div class="card-field">
                        <label>重命名模式（变量：{name} {date} {tags} {rating} {ext} {index} {ai}）</label>
                        <input type="text" data-index="${i}" class="action-pattern"
                            value="${Utils.escapeHtml(action.pattern || '')}"
                            placeholder="例如：{tags}-{date}-{index}" />
                    </div>`;
            }

            // 文件夹选择
            if (isFolder) {
                html += `
                    <div class="card-field">
                        <label>目标文件夹</label>
                        <select data-index="${i}" class="action-folder">
                            <option value="">-- 选择文件夹 --</option>
                        </select>
                    </div>`;
            }

            html += `</div></div>`;
        }

        // 底部添加按钮
        html += `
            <div class="add-action-area" style="padding:12px;">
                <button class="btn-add-action" onclick="App._showAddActionPopup()" title="添加动作" style="width:36px;height:36px;font-size:18px;">+</button>
            </div>`;

        container.innerHTML = html;

        if (this._actions.some((a) => a.type === 'folder')) {
            setTimeout(() => this._loadFolderSelects(), 100);
        }
    },

    _getPlaceholder(type) {
        const map = {
            description: '例如：用中文描述这张图片的主要内容、风格和色彩特点',
            tags: '例如：为这张图片生成5-10个精准的中文标签',
            rating: '例如：从构图、色彩、创意三个维度评分（1-5星）',
            folder: '例如：根据文件夹内素材统计，生成文件夹概述',
            rename: '例如：根据素材内容生成简洁的文件名',
        };
        return map[type] || '输入 AI 指令...';
    },

    /** 弹出动作类型选择窗口 */
    _showAddActionPopup() {
        let gridHtml = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">';
        for (const [key, cfg] of Object.entries(this._actionTypes)) {
            gridHtml += `
                <div class="action-type-option" onclick="App._addAction('${key}');UI.closeModal();"
                     style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 8px;
                            background:var(--bg-input);border:2px solid var(--border);border-radius:var(--radius);
                            cursor:pointer;transition:var(--transition);text-align:center;"
                     onmouseover="this.style.borderColor='${cfg.color}'"
                     onmouseout="this.style.borderColor='var(--border)'">
                    <div class="action-type-icon ${cfg.iconClass}" style="width:36px;height:36px;font-size:18px;">${cfg.icon}</div>
                    <span style="font-size:12px;font-weight:600;">${cfg.label}</span>
                </div>`;
        }
        gridHtml += '</div>';

        UI.showModal('选择动作类型', gridHtml, `
            <button class="btn" onclick="UI.closeModal()">取消</button>
        `);
    },

    _addAction(type) {
        const action = {
            type: type || 'description',
            instruction: '',
            mode: 'overwrite',
            excludeTags: [],
            pattern: '',
            folderId: '',
            prompt: '',
        };
        this._actions.push(action);
        this._renderActionPanel();
    },

    _removeAction(index) {
        this._actions.splice(index, 1);
        this._renderActionPanel();
    },

    _onActionTypeChange(index, newType) {
        this._actions[index].type = newType;
        this._renderActionPanel();
    },

    async _loadFolderSelects() {
        try {
            const folders = await FolderService.getRegularFolders();
            const selects = document.querySelectorAll('.action-folder');
            for (const select of selects) {
                const currentVal = select.value;
                select.innerHTML = '<option value="">-- 选择文件夹 --</option>';
                for (const f of folders) {
                    select.innerHTML += `<option value="${f.id}" ${f.id === currentVal ? 'selected' : ''}>${Utils.escapeHtml(f.name || '(未命名)')}</option>`;
                }
            }
        } catch (e) {
            console.error('加载文件夹失败:', e);
        }
    },

    // ========== 同步数据 ==========

    _syncActions() {
        for (let i = 0; i < this._actions.length; i++) {
            const action = this._actions[i];
            const instruction = document.querySelector(`.action-instruction[data-index="${i}"]`);
            const systemPrompt = document.querySelector(`.action-system-prompt[data-index="${i}"]`);
            const mode = document.querySelector(`.action-mode[data-index="${i}"]`);
            const exclude = document.querySelector(`.action-exclude[data-index="${i}"]`);
            const pattern = document.querySelector(`.action-pattern[data-index="${i}"]`);
            const folder = document.querySelector(`.action-folder[data-index="${i}"]`);

            if (instruction) action.instruction = instruction.value;
            if (systemPrompt) action.prompt = systemPrompt.value;
            if (mode) action.mode = mode.value;
            if (exclude) action.excludeTags = exclude.value.split(',').map((t) => t.trim()).filter(Boolean);
            if (pattern) action.pattern = pattern.value;
            if (folder) action.folderId = folder.value;
        }
    },

    // ========== 执行引擎 ==========

    async _executeAll() {
        if (this._running) return;
        if (this._actions.length === 0) {
            UI.showToast('请先添加至少一个动作', 'warning');
            return;
        }

        this._syncActions();

        const hasFolderAction = this._actions.some((a) => a.type === 'folder');
        const hasItemAction = this._actions.some((a) => a.type !== 'folder' && a.type !== 'system');

        let taskItems = [];
        if (hasItemAction) {
            if (this._taskItems.length === 0) {
                UI.showToast('请在 Eagle 中选择素材', 'warning');
                return;
            }
            taskItems = this._taskItems;
        }

        if (hasFolderAction) {
            for (const action of this._actions) {
                if (action.type === 'folder' && !action.folderId) {
                    UI.showToast('请为"文件夹分析"动作选择目标文件夹', 'warning');
                    return;
                }
            }
        }

        const needsAI = this._actions.some((a) =>
            a.type !== 'system' && a.type !== 'folder' &&
            (a.type !== 'rename' || (a.pattern && a.pattern.includes('{ai}')))
        );
        if (needsAI && !AIService.hasModel()) {
            UI.showToast('请先在设置中配置 AI 模型', 'warning');
            return;
        }

        this._running = true;
        this._tempSystemPrompt = null;

        const execBtn = document.getElementById('btn-execute');
        if (execBtn) { execBtn.disabled = true; execBtn.textContent = '执行中...'; }

        const totalItems = taskItems.length;
        let globalIndex = 0;

        try {
            // 先处理文件夹动作
            for (const action of this._actions) {
                if (action.type !== 'folder') continue;
                await this._executeSingleAction(action, null, 0, 1);
            }

            // 处理素材动作
            if (taskItems.length > 0) {
                for (let i = 0; i < taskItems.length; i++) {
                    const item = taskItems[i];
                    this._updateTaskItem(item.id, 'running', 0);

                    for (const action of this._actions) {
                        if (action.type === 'folder') continue;
                        try {
                            const freshItem = (action.type !== 'system')
                                ? await ItemService.getById(item.id)
                                : null;
                            await this._executeSingleAction(action, freshItem, i, totalItems);
                        } catch (e) {
                            console.error(`动作执行失败 [${item.name}]:`, e);
                        }
                    }

                    this._updateTaskItem(item.id, 'done', 100);
                    globalIndex++;
                    this._updateOverallProgress(Math.round((globalIndex / totalItems) * 100));
                }
            }

            UI.showToast('全部动作执行完成', 'success');
            UI.setStatus('就绪');
        } catch (e) {
            console.error('执行失败:', e);
            UI.showToast('执行出错: ' + (e.message || '未知错误'), 'error');
        } finally {
            this._running = false;
            this._tempSystemPrompt = null;
            if (execBtn) { execBtn.disabled = false; execBtn.textContent = '执行全部动作'; }
            await this.refreshSelection();
        }
    },

    /** 获取当前生效的系统提示词（临时 > 动作 > 全局） */
    _getEffectiveSystemPrompt() {
        return this._tempSystemPrompt || SettingsStore.getGlobalSystemPrompt();
    },

    async _executeSingleAction(action, item, itemIndex, totalItems) {
        switch (action.type) {
            case 'system': {
                // 系统提示词动作：设置临时提示词，影响后续动作
                this._tempSystemPrompt = action.prompt || '';
                break;
            }
            case 'description': {
                if (!item) return;
                const sp = this._getEffectiveSystemPrompt();
                const desc = await AIService.generateDescription(item, action.instruction, sp);
                await ItemService.updateAnnotation(item, desc, action.mode || 'overwrite');
                break;
            }
            case 'tags': {
                if (!item) return;
                const sp = this._getEffectiveSystemPrompt();
                const tagResult = await AIService.generateTags(item, action.instruction, sp, item.tags || []);
                await ItemService.updateTags(item, tagResult.tags, action.mode || 'merge', action.excludeTags);
                break;
            }
            case 'rating': {
                if (!item) return;
                const sp = this._getEffectiveSystemPrompt();
                const ratingResult = await AIService.generateRating(item, action.instruction, sp);
                await ItemService.updateRating(item, ratingResult.rating);
                break;
            }
            case 'rename': {
                if (!item) return;
                const sp = this._getEffectiveSystemPrompt();
                const pattern = action.pattern || '{name}';
                let newName = pattern
                    .replace(/\{name\}/g, (item.name || '').replace(/\.[^.]+$/, ''))
                    .replace(/\{date\}/g, new Date().toISOString().slice(0, 10))
                    .replace(/\{tags\}/g, (item.tags || []).slice(0, 3).join('-'))
                    .replace(/\{rating\}/g, '★'.repeat(item.star || 0))
                    .replace(/\{ext\}/g, item.ext || '')
                    .replace(/\{index\}/g, String(itemIndex + 1).padStart(2, '0'));
                if (pattern.includes('{ai}')) {
                    try {
                        const aiName = await AIService.generateFilename(item, '简短中文文件名（不超过15字）', sp);
                        newName = newName.replace(/\{ai\}/g, aiName.trim() || 'untitled');
                    } catch (e) {
                        newName = newName.replace(/\{ai\}/g, 'untitled');
                    }
                }
                newName = newName.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, '_');
                await ItemService.renameItem(item, newName);
                break;
            }
            case 'folder': {
                const folderId = action.folderId;
                if (!folderId) return;
                const sp = this._getEffectiveSystemPrompt();
                const stats = await FolderService.analyzeFolder(folderId);
                const folder = await FolderService.getById(folderId);
                const desc = await AIService.analyzeFolder(stats, action.instruction, sp);
                await FolderService.updateDescription(folder, desc);
                UI.showToast(`文件夹"${folder.name}"分析完成`, 'success');
                break;
            }
        }
    },

    _updateOverallProgress(percent) {
        UI.setStatus(`执行中: ${percent}%`);
    },

    // ========== 模板操作 ==========

    _saveAsTemplate() {
        this._syncActions();
        if (this._actions.length === 0) {
            UI.showToast('请先添加至少一个动作', 'warning');
            return;
        }

        // 生成动作摘要用于列表展示
        const summary = this._actions
            .map((a) => (this._actionTypes[a.type]?.label || a.type))
            .join(' + ');

        const bodyHtml = `
            <div class="settings-field">
                <label>模板名称（2-4字）</label>
                <input type="text" id="tpl-save-name" placeholder="例如：标准标注" maxlength="8" />
            </div>
            <p style="font-size:11px;color:var(--text-muted);">保存当前 ${this._actions.length} 个动作：${summary}</p>
        `;

        UI.showModal('保存为模板', bodyHtml, `
            <button class="btn" onclick="UI.closeModal()">取消</button>
            <button class="btn btn-primary" id="tpl-save-confirm">保存</button>
        `);

        document.getElementById('tpl-save-confirm').addEventListener('click', () => {
            const name = document.getElementById('tpl-save-name').value.trim();
            if (!name) { UI.showToast('请输入模板名称', 'warning'); return; }

            // 存储完整动作列表为 _actions，instruction 作为概要
            TemplateStore.create({
                name,
                actionType: this._actions.length === 1 ? this._actions[0].type : 'mixed',
                instruction: summary,
                overwriteMode: this._actions[0]?.mode || 'overwrite',
                _actions: JSON.parse(JSON.stringify(this._actions)),
            });
            UI.closeModal();
            this._renderTemplateBar();
            UI.showToast('模板已保存', 'success');
        });
    },

    _loadTemplate() {
        const templates = TemplateStore.getAll();
        if (templates.length === 0) {
            UI.showToast('还没有保存的模板', 'info');
            return;
        }

        let listHtml = '';
        for (const t of templates) {
            const typeLabel = t._actions && t._actions.length > 1
                ? `${t._actions.length} 个动作`
                : TemplateStore.getActionTypeLabel(t.actionType);
            listHtml += `
                <div class="template-load-item" style="display:flex;align-items:center;gap:10px;padding:8px 10px;
                    border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:4px;background:var(--bg-input);">
                    <div style="flex:1;cursor:pointer;" onclick="App._applyTemplate('${t.id}')">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span class="tag">${typeLabel}</span>
                            <strong>${Utils.escapeHtml(t.name)}</strong>
                        </div>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${Utils.escapeHtml(Utils.truncate(t.instruction, 50))}</div>
                    </div>
                    <button class="btn btn-sm btn-danger" onclick="App._deleteTemplate('${t.id}')" title="删除模板">✕</button>
                </div>`;
        }

        UI.showModal('加载模板', `<div style="max-height:350px;overflow-y:auto;">${listHtml}</div>`,
            `<button class="btn" onclick="UI.closeModal()">取消</button>`);
    },

    _applyTemplate(templateId) {
        const template = TemplateStore.getById(templateId);
        if (!template) return;
        UI.closeModal();

        if (template._actions && Array.isArray(template._actions)) {
            this._actions = JSON.parse(JSON.stringify(template._actions));
        } else {
            this._actions = [{
                type: template.actionType || 'description',
                instruction: template.instruction || '',
                mode: template.overwriteMode || 'overwrite',
                excludeTags: [],
                pattern: '',
                folderId: '',
                prompt: '',
            }];
        }

        this._renderActionPanel();
        UI.showToast(`已加载模板"${template.name}"`, 'success');
    },

    _deleteTemplate(templateId) {
        const template = TemplateStore.getById(templateId);
        if (!template) return;

        UI.showModal('确认删除',
            `<p>确定要删除模板 "<strong>${Utils.escapeHtml(template.name)}</strong>" 吗？</p>
             <p style="color:var(--text-muted);font-size:11px;">此操作不可撤销</p>`,
            `<button class="btn" onclick="UI.closeModal()">取消</button>
             <button class="btn btn-danger" id="tpl-del-confirm">确认删除</button>`
        );

        document.getElementById('tpl-del-confirm').addEventListener('click', () => {
            try {
                TemplateStore.delete(templateId);
                UI.closeModal();
                this._renderTemplateBar();
                this._loadTemplate(); // 刷新已打开的模态框
                UI.showToast('模板已删除', 'info');
            } catch (e) {
                UI.showToast('删除失败: ' + e.message, 'error');
            }
        });
    },

    // ========== 底部模板栏 ==========

    _renderTemplateBar() {
        const container = document.getElementById('template-list');
        if (!container) return;

        const templates = TemplateStore.getAll();
        if (templates.length === 0) {
            container.innerHTML = '<span class="template-item" style="color:var(--text-muted);">暂无模板</span>';
            return;
        }

        let html = '';
        for (let i = 0; i < templates.length; i++) {
            if (i > 0) html += '<span class="template-sep">·</span>';
            const name = templates[i].name.length > 4
                ? templates[i].name.slice(0, 4) + '…'
                : templates[i].name;
            html += `<span class="template-item" onclick="App._applyTemplate('${templates[i].id}')" title="${Utils.escapeHtml(templates[i].name)}">${Utils.escapeHtml(name)}</span>`;
        }
        container.innerHTML = html;
    },

    // ========== 设置面板 ==========

    _openSettings() {
        const settings = SettingsStore.getAll();
        const hasModel = AIService.isReady() && AIService.hasModel();
        const defaultLLM = AIService.isReady() ? AIService._ai?.getDefaultModel('chat') || '未配置' : '不可用';
        const defaultVLM = AIService.isReady() ? AIService._ai?.getDefaultModel('image') || '未配置' : '不可用';

        const bodyHtml = `
            <div class="settings-section">
                <h4>AI 模型</h4>
                <div class="info-box ${hasModel ? 'info-box-info' : 'info-box-warning'}" style="margin-bottom:10px;">
                    ${hasModel ? '✅ AI 模型已配置' : '⚠ 未配置 AI 模型'}
                </div>
                <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">
                    语言模型: ${defaultLLM}<br/>视觉模型: ${defaultVLM}
                </div>
                <div style="display:flex;gap:8px;">
                    <button class="btn btn-sm btn-outline" id="s-open-ai">打开 AI 设置</button>
                    <button class="btn btn-sm btn-outline" id="s-reload-ai">刷新模型</button>
                </div>
            </div>

            <div class="settings-section">
                <h4>全局系统提示词</h4>
                <div class="settings-field">
                    <textarea id="s-system-prompt" rows="3" placeholder="例如：你是一个专业的视觉内容分析助手...">${Utils.escapeHtml(settings.globalSystemPrompt || '')}</textarea>
                </div>
                <div class="help-text">此提示词将用于所有未设置"系统提示词"动作的 AI 调用。可使用"系统提示词"动作在模板中覆盖此项。</div>
            </div>

            <div class="settings-section">
                <h4>标签保护</h4>
                <div class="settings-field">
                    <label>排除标签（逗号分隔，这些标签不会被清理）</label>
                    <input type="text" id="s-exclude-tags" value="${(settings.excludeTags || []).join(', ')}" placeholder="例如：收藏, 重要" />
                </div>
            </div>

            <div class="settings-section">
                <h4>默认设置</h4>
                <div class="card-field-row" style="display:flex;gap:10px;">
                    <div class="settings-field" style="flex:1;">
                        <label>描述写入模式</label>
                        <select id="s-desc-mode">
                            <option value="overwrite" ${settings.descOverwriteMode === 'overwrite' ? 'selected' : ''}>覆盖</option>
                            <option value="append" ${settings.descOverwriteMode === 'append' ? 'selected' : ''}>追加</option>
                        </select>
                    </div>
                    <div class="settings-field" style="flex:1;">
                        <label>标签写入模式</label>
                        <select id="s-tag-mode">
                            <option value="merge" ${settings.tagOverwriteMode === 'merge' ? 'selected' : ''}>合并</option>
                            <option value="replace" ${settings.tagOverwriteMode === 'replace' ? 'selected' : ''}>替换</option>
                        </select>
                    </div>
                </div>
            </div>
        `;

        UI.showModal('设置', bodyHtml, `
            <button class="btn btn-outline" id="s-reset">恢复默认</button>
            <button class="btn" onclick="UI.closeModal()">取消</button>
            <button class="btn btn-primary" id="s-save">保存设置</button>
        `);

        setTimeout(() => {
            document.getElementById('s-open-ai')?.addEventListener('click', () => AIService.openSettings());
            document.getElementById('s-reload-ai')?.addEventListener('click', () => {
                AIService.reload();
                UI.showToast('模型配置已刷新', 'success');
                UI.closeModal();
                this._openSettings();
            });
            document.getElementById('s-reset')?.addEventListener('click', () => {
                SettingsStore.reset();
                UI.showToast('设置已重置', 'info');
                UI.closeModal();
            });
            document.getElementById('s-save')?.addEventListener('click', () => {
                SettingsStore.update({
                    globalSystemPrompt: document.getElementById('s-system-prompt')?.value || '',
                    excludeTags: (document.getElementById('s-exclude-tags')?.value || '')
                        .split(',').map((t) => t.trim()).filter(Boolean),
                    descOverwriteMode: document.getElementById('s-desc-mode')?.value || 'overwrite',
                    tagOverwriteMode: document.getElementById('s-tag-mode')?.value || 'merge',
                });
                UI.showToast('设置已保存', 'success');
                UI.closeModal();
            });
        }, 100);
    },
};
