/* ============================================================
   app.js - AI Tagger 主应用逻辑
   动作卡片管理、任务列表、模板栏、执行引擎
   ============================================================ */

const App = {
    /** 动作卡片列表 */
    _actions: [],
    /** 当前选中的任务项 */
    _taskItems: [],
    /** 是否正在执行 */
    _running: false,
    /** 模板选择是否打开 */
    _templateOpen: false,

    // ========== 动作类型配置 ==========
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
        comprehensive: {
            label: '综合分析',
            icon: '🔍',
            iconClass: 'icon-comprehensive',
            color: '#a78bfa',
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

    /**
     * 初始化应用（在 plugin.js onPluginCreate 中调用）
     */
    init() {
        this._renderActionPanel();
        this._renderTemplateBar();
        this._bindEvents();
    },

    /**
     * 刷新选中素材
     */
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
        // 关闭按钮
        document.getElementById('btn-close').addEventListener('click', () => {
            window.close();
        });

        // 设置按钮
        document.getElementById('btn-settings').addEventListener('click', () => {
            this._openSettings();
        });

        // 保存模板
        document.getElementById('btn-save-template').addEventListener('click', () => {
            this._saveAsTemplate();
        });

        // 加载模板
        document.getElementById('btn-load-template').addEventListener('click', () => {
            this._loadTemplate();
        });

        // 执行按钮
        document.getElementById('btn-execute').addEventListener('click', () => {
            this._executeAll();
        });
    },

    // ========== 任务列表渲染 ==========

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
            countEl.textContent = '';
            return;
        }

        countEl.textContent = `${this._taskItems.length} 个`;

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

    /**
     * 更新单个任务项的状态
     */
    _updateTaskItem(itemId, status, progress) {
        const item = this._taskItems.find((t) => t.id === itemId);
        if (item) {
            item._status = status;
            item._progress = progress || 0;
        }
        this._renderTaskList();
    },

    // ========== 动作面板渲染 ==========

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
            countEl.textContent = '';

            // 绑定 + 按钮
            setTimeout(() => {
                const btn = document.getElementById('btn-add-first');
                if (btn) btn.addEventListener('click', () => this._addAction());
            }, 50);
            return;
        }

        countEl.textContent = `${this._actions.length} 个`;
        footer.classList.remove('hidden');

        let html = '';
        for (let i = 0; i < this._actions.length; i++) {
            const action = this._actions[i];
            const typeCfg = this._actionTypes[action.type] || this._actionTypes.description;
            const isDesc = action.type === 'description';
            const isTags = action.type === 'tags';
            const isRating = action.type === 'rating';
            const isComp = action.type === 'comprehensive';
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
                <div class="action-card-body">
                    <div class="card-field">
                        <label>指令</label>
                        <textarea data-index="${i}" class="action-instruction" rows="2"
                            placeholder="${this._getPlaceholder(action.type)}">${Utils.escapeHtml(action.instruction || '')}</textarea>
                    </div>`;

            // 写入模式（描述、标签、评分、综合）
            if (!isFolder && !isRename) {
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

            // 排除标签（标签操作和综合分析）
            if (isTags || isComp) {
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

        // 添加动作按钮
        html += `
            <div class="add-action-area" style="padding:12px;">
                <button class="btn-add-action" onclick="App._addAction()" title="添加动作" style="width:36px;height:36px;font-size:18px;">+</button>
            </div>`;

        container.innerHTML = html;

        // 延迟加载文件夹列表
        if (this._actions.some((a) => a.type === 'folder')) {
            setTimeout(() => this._loadFolderSelects(), 100);
        }
    },

    _getPlaceholder(type) {
        const map = {
            description: '例如：用中文描述这张图片的主要内容、风格和色彩特点',
            tags: '例如：为这张图片生成5-10个精准的中文标签',
            rating: '例如：从构图、色彩、创意三个维度评分（1-5星）',
            comprehensive: '例如：全面分析这张图片，包括描述、标签和评分',
            folder: '例如：根据文件夹内素材统计，生成文件夹概述',
            rename: '例如：根据素材内容生成简洁的文件名',
        };
        return map[type] || '输入 AI 指令...';
    },

    /** 添加新动作 */
    _addAction(type) {
        this._actions.push({
            type: type || 'description',
            instruction: '',
            mode: 'overwrite',
            excludeTags: [],
            pattern: '',
            folderId: '',
        });
        this._renderActionPanel();
    },

    /** 移除动作 */
    _removeAction(index) {
        this._actions.splice(index, 1);
        this._renderActionPanel();
    },

    /** 动作类型变更 */
    _onActionTypeChange(index, newType) {
        this._actions[index].type = newType;
        this._renderActionPanel();
    },

    /** 加载文件夹选项 */
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

    // ========== 读取动作数据 ==========

    /** 从 DOM 同步读取所有动作的当前值 */
    _syncActions() {
        for (let i = 0; i < this._actions.length; i++) {
            const instruction = document.querySelector(`.action-instruction[data-index="${i}"]`);
            const mode = document.querySelector(`.action-mode[data-index="${i}"]`);
            const exclude = document.querySelector(`.action-exclude[data-index="${i}"]`);
            const pattern = document.querySelector(`.action-pattern[data-index="${i}"]`);
            const folder = document.querySelector(`.action-folder[data-index="${i}"]`);

            if (instruction) this._actions[i].instruction = instruction.value;
            if (mode) this._actions[i].mode = mode.value;
            if (exclude) {
                this._actions[i].excludeTags = exclude.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean);
            }
            if (pattern) this._actions[i].pattern = pattern.value;
            if (folder) this._actions[i].folderId = folder.value;
        }
    },

    // ========== 执行引擎 ==========

    async _executeAll() {
        if (this._running) return;
        if (this._actions.length === 0) {
            UI.showToast('请先添加至少一个动作', 'warning');
            return;
        }

        // 同步动作数据
        this._syncActions();

        // 检查是否有文件夹动作
        const hasFolderAction = this._actions.some((a) => a.type === 'folder');
        const hasItemAction = this._actions.some((a) => a.type !== 'folder');

        // 获取任务项
        let taskItems = [];
        if (hasItemAction) {
            if (this._taskItems.length === 0) {
                UI.showToast('请在 Eagle 中选择素材', 'warning');
                return;
            }
            taskItems = this._taskItems;
        }

        if (hasFolderAction) {
            // 文件夹动作需要选择文件夹
            for (const action of this._actions) {
                if (action.type === 'folder' && !action.folderId) {
                    UI.showToast('请为"文件夹分析"动作选择目标文件夹', 'warning');
                    return;
                }
            }
        }

        // 检查 AI 可用性
        const needsAI = this._actions.some((a) => a.type !== 'rename' || (a.pattern && a.pattern.includes('{ai}')));
        if (needsAI && !AIService.hasModel()) {
            UI.showToast('请先在设置中配置 AI 模型', 'warning');
            return;
        }

        this._running = true;
        const execBtn = document.getElementById('btn-execute');
        if (execBtn) {
            execBtn.disabled = true;
            execBtn.textContent = '执行中...';
        }

        const totalItems = taskItems.length;
        let globalIndex = 0;

        try {
            // 先处理文件夹动作（无 item 循环）
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
                            // 重新获取最新的 item 数据
                            const freshItem = await ItemService.getById(item.id);
                            await this._executeSingleAction(action, freshItem, i, totalItems);
                        } catch (e) {
                            console.error(`动作执行失败 [${item.name}]:`, e);
                        }
                    }

                    this._updateTaskItem(item.id, 'done', 100);
                    globalIndex++;

                    // 更新总体进度
                    const overallProgress = Math.round((globalIndex / totalItems) * 100);
                    this._updateOverallProgress(overallProgress);
                }
            }

            UI.showToast('全部动作执行完成', 'success');
            UI.setStatus('就绪');
        } catch (e) {
            console.error('执行失败:', e);
            UI.showToast('执行出错: ' + (e.message || '未知错误'), 'error');
        } finally {
            this._running = false;
            if (execBtn) {
                execBtn.disabled = false;
                execBtn.textContent = '执行全部动作';
            }
            await this.refreshSelection();
        }
    },

    async _executeSingleAction(action, item, itemIndex, totalItems) {
        const systemPrompt = SettingsStore.getGlobalSystemPrompt();

        switch (action.type) {
            case 'description': {
                if (!item) return;
                const desc = await AIService.generateDescription(item, action.instruction, systemPrompt);
                await ItemService.updateAnnotation(item, desc, action.mode || 'overwrite');
                break;
            }
            case 'tags': {
                if (!item) return;
                const tagResult = await AIService.generateTags(
                    item, action.instruction, systemPrompt, item.tags || []
                );
                await ItemService.updateTags(
                    item, tagResult.tags, action.mode || 'merge', action.excludeTags
                );
                break;
            }
            case 'rating': {
                if (!item) return;
                const ratingResult = await AIService.generateRating(item, action.instruction, systemPrompt);
                await ItemService.updateRating(item, ratingResult.rating);
                break;
            }
            case 'comprehensive': {
                if (!item) return;
                const comp = await AIService.generateComprehensive(item, action.instruction, systemPrompt);
                await ItemService.updateAnnotation(
                    item, comp.description,
                    action.mode === 'append' ? 'append' : 'overwrite'
                );
                await ItemService.updateTags(
                    item, comp.tags,
                    action.mode === 'merge' ? 'merge' : 'replace',
                    action.excludeTags
                );
                if (comp.rating) {
                    await ItemService.updateRating(item, comp.rating);
                }
                break;
            }
            case 'rename': {
                if (!item) return;
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
                        const aiName = await AIService.generateFilename(item, '简短中文文件名（不超过15字）', systemPrompt);
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
                // 文件夹分析动作不依赖 item
                const folderId = action.folderId;
                if (!folderId) return;

                const stats = await FolderService.analyzeFolder(folderId);
                const folder = await FolderService.getById(folderId);
                const desc = await AIService.analyzeFolder(stats, action.instruction, systemPrompt);
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

        const bodyHtml = `
            <div class="settings-field">
                <label>模板名称（2-4字）</label>
                <input type="text" id="tpl-save-name" placeholder="例如：标准标注" maxlength="8" />
            </div>
            <p style="font-size:11px;color:var(--text-muted);">将保存当前 ${this._actions.length} 个动作配置</p>
        `;

        UI.showModal('保存为模板', bodyHtml, `
            <button class="btn" onclick="UI.closeModal()">取消</button>
            <button class="btn btn-primary" id="tpl-save-confirm">保存</button>
        `);

        document.getElementById('tpl-save-confirm').addEventListener('click', () => {
            const name = document.getElementById('tpl-save-name').value.trim();
            if (!name) {
                UI.showToast('请输入模板名称', 'warning');
                return;
            }
            TemplateStore.create({
                name,
                actionType: this._actions.length === 1 ? this._actions[0].type : 'comprehensive',
                instruction: this._actions.map((a, i) => `${i + 1}. [${this._actionTypes[a.type]?.label || a.type}] ${a.instruction}`).join('\n'),
                overwriteMode: this._actions[0]?.mode || 'overwrite',
                _actions: JSON.parse(JSON.stringify(this._actions)), // 存储完整动作列表
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
            listHtml += `
                <div class="task-item" style="cursor:pointer;flex-direction:column;align-items:flex-start;gap:4px;" onclick="App._applyTemplate('${t.id}')">
                    <div style="display:flex;align-items:center;gap:8px;width:100%;">
                        <span class="tag">${TemplateStore.getActionTypeLabel(t.actionType)}</span>
                        <strong>${Utils.escapeHtml(t.name)}</strong>
                    </div>
                    <div style="font-size:11px;color:var(--text-muted);">${Utils.escapeHtml(Utils.truncate(t.instruction, 60))}</div>
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
            // 新版多动作模板
            this._actions = JSON.parse(JSON.stringify(template._actions));
        } else {
            // 旧版单动作模板 → 转换为单动作
            this._actions = [{
                type: template.actionType || 'comprehensive',
                instruction: template.instruction || '',
                mode: template.overwriteMode || 'overwrite',
                excludeTags: [],
                pattern: '',
                folderId: '',
            }];
        }

        this._renderActionPanel();
        UI.showToast(`已加载模板"${template.name}"`, 'success');
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
                    语言模型: ${defaultLLM}<br/>
                    视觉模型: ${defaultVLM}
                </div>
                <button class="btn btn-sm btn-outline" id="s-open-ai">打开 AI 设置</button>
                <button class="btn btn-sm btn-outline" id="s-reload-ai">刷新模型</button>
            </div>

            <div class="settings-section">
                <h4>全局系统提示词</h4>
                <div class="settings-field">
                    <textarea id="s-system-prompt" rows="3" placeholder="例如：你是一个专业的视觉内容分析助手...">${Utils.escapeHtml(settings.globalSystemPrompt || '')}</textarea>
                </div>
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
                <div class="settings-field">
                    <label>描述写入模式</label>
                    <select id="s-desc-mode">
                        <option value="overwrite" ${settings.descOverwriteMode === 'overwrite' ? 'selected' : ''}>覆盖</option>
                        <option value="append" ${settings.descOverwriteMode === 'append' ? 'selected' : ''}>追加</option>
                    </select>
                </div>
                <div class="settings-field">
                    <label>标签写入模式</label>
                    <select id="s-tag-mode">
                        <option value="merge" ${settings.tagOverwriteMode === 'merge' ? 'selected' : ''}>合并</option>
                        <option value="replace" ${settings.tagOverwriteMode === 'replace' ? 'selected' : ''}>替换</option>
                    </select>
                </div>
            </div>
        `;

        UI.showModal('设置', bodyHtml, `
            <button class="btn btn-outline" id="s-reset">恢复默认</button>
            <button class="btn" onclick="UI.closeModal()">取消</button>
            <button class="btn btn-primary" id="s-save">保存设置</button>
        `);

        // 事件绑定
        setTimeout(() => {
            document.getElementById('s-open-ai')?.addEventListener('click', () => {
                AIService.openSettings();
            });
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
