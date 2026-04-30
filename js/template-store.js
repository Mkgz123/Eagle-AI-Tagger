/* ============================================================
   template-store.js - 动作模板 CRUD 与持久化
   存储位置：插件目录/data/templates.json
   ============================================================ */

const TemplateStore = {
    _templates: [],
    _filePath: null,
    _fs: null,

    /** 动作类型常量 */
    ActionTypes: {
        DESCRIPTION: 'description',
        TAGS: 'tags',
        RATING: 'rating',
        SYSTEM: 'system',
        FOLDER: 'folder',
        RENAME: 'rename',
        MIXED: 'mixed',
    },

    /**
     * 初始化 - 在 plugin.js onPluginCreate 中调用
     */
    init(pluginPath) {
        this._fs = require('fs');
        const path = require('path');
        this._filePath = path.join(pluginPath, 'data', 'templates.json');
        this._load();
    },

    /**
     * 从文件加载模板
     */
    _load() {
        try {
            if (this._fs.existsSync(this._filePath)) {
                const raw = this._fs.readFileSync(this._filePath, 'utf-8');
                this._templates = JSON.parse(raw);
            } else {
                this._templates = this._getDefaultTemplates();
                this._save();
            }
        } catch (e) {
            console.error('加载模板失败:', e);
            this._templates = this._getDefaultTemplates();
        }
    },

    /**
     * 保存模板到文件
     */
    _save() {
        try {
            const dir = require('path').dirname(this._filePath);
            if (!this._fs.existsSync(dir)) {
                this._fs.mkdirSync(dir, { recursive: true });
            }
            this._fs.writeFileSync(this._filePath, JSON.stringify(this._templates, null, 2), 'utf-8');
        } catch (e) {
            console.error('保存模板失败:', e);
            throw new Error('保存模板失败: ' + e.message);
        }
    },

    /**
     * 获取默认模板
     */
    _getDefaultTemplates() {
        return [
            {
                id: Utils.uid(),
                name: '描述',
                actionType: 'description',
                instruction: '请用简洁的中文描述这张图片的内容、风格和主要视觉元素。',
                systemPrompt: '',
                overwriteMode: 'overwrite',
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            {
                id: Utils.uid(),
                name: '标签',
                actionType: 'tags',
                instruction: '请为这张图片生成5-10个精准的中文标签。',
                systemPrompt: '',
                overwriteMode: 'merge',
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            {
                id: Utils.uid(),
                name: '评分',
                actionType: 'rating',
                instruction: '请从构图、色彩、创意、技术质量四个维度评估，给出1-5星评分。',
                systemPrompt: '',
                overwriteMode: 'overwrite',
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
        ];
    },

    /**
     * 获取所有模板
     */
    getAll() {
        return [...this._templates];
    },

    /**
     * 按动作类型过滤模板
     */
    getByType(actionType) {
        return this._templates.filter((t) => t.actionType === actionType);
    },

    /**
     * 按 ID 获取模板
     */
    getById(id) {
        return this._templates.find((t) => t.id === id) || null;
    },

    /**
     * 创建模板
     */
    create(data) {
        const template = {
            id: Utils.uid(),
            name: data.name || '未命名模板',
            actionType: data.actionType || 'description',
            instruction: data.instruction || '',
            systemPrompt: data.systemPrompt || '',
            overwriteMode: data.overwriteMode || 'overwrite',
            _actions: data._actions || null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        this._templates.push(template);
        this._save();
        return template;
    },

    /**
     * 更新模板
     */
    update(id, data) {
        const index = this._templates.findIndex((t) => t.id === id);
        if (index === -1) throw new Error('模板不存在: ' + id);

        const allowed = ['name', 'actionType', 'instruction', 'systemPrompt', 'overwriteMode'];
        for (const key of allowed) {
            if (data[key] !== undefined) {
                this._templates[index][key] = data[key];
            }
        }
        this._templates[index].updatedAt = Date.now();
        this._save();
        return this._templates[index];
    },

    /**
     * 删除模板
     */
    delete(id) {
        const index = this._templates.findIndex((t) => t.id === id);
        if (index === -1) throw new Error('模板不存在: ' + id);
        this._templates.splice(index, 1);
        this._save();
    },

    /**
     * 获取动作类型中文名
     */
    getActionTypeLabel(type) {
        const map = {
            description: '描述',
            tags: '标签',
            rating: '评分',
            system: '提示词',
            folder: '文件夹',
            rename: '重命名',
            mixed: '组合',
        };
        return map[type] || type;
    },

    /**
     * 获取覆盖模式中文名
     */
    getOverwriteModeLabel(mode) {
        const map = {
            overwrite: '覆盖',
            append: '追加',
            merge: '合并',
        };
        return map[mode] || mode;
    },
};
