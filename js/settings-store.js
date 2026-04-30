/* ============================================================
   settings-store.js - 全局设置持久化
   存储位置：插件目录/data/settings.json
   ============================================================ */

const SettingsStore = {
    _data: null,
    _filePath: null,
    _fs: null,

    /** 默认设置 */
    _defaults: {
        globalSystemPrompt: '',
        defaultAction: 'comprehensive',
        excludeTags: [],
        autoCleanTags: false,
        tagOverwriteMode: 'merge',    // 'merge' | 'replace'
        descOverwriteMode: 'overwrite', // 'overwrite' | 'append'
        ratingThreshold: 3,
        language: 'zh',
    },

    /**
     * 初始化 - 在 plugin.js onPluginCreate 中调用
     */
    init(pluginPath) {
        this._fs = require('fs');
        const path = require('path');
        this._filePath = path.join(pluginPath, 'data', 'settings.json');
        this._load();
    },

    /**
     * 从文件加载设置
     */
    _load() {
        try {
            if (this._fs.existsSync(this._filePath)) {
                const raw = this._fs.readFileSync(this._filePath, 'utf-8');
                this._data = { ...this._defaults, ...JSON.parse(raw) };
            } else {
                this._data = { ...this._defaults };
                this._save();
            }
        } catch (e) {
            console.error('加载设置失败:', e);
            this._data = { ...this._defaults };
        }
    },

    /**
     * 保存设置到文件
     */
    _save() {
        try {
            const dir = require('path').dirname(this._filePath);
            if (!this._fs.existsSync(dir)) {
                this._fs.mkdirSync(dir, { recursive: true });
            }
            this._fs.writeFileSync(this._filePath, JSON.stringify(this._data, null, 2), 'utf-8');
        } catch (e) {
            console.error('保存设置失败:', e);
            throw new Error('保存设置失败: ' + e.message);
        }
    },

    /**
     * 获取所有设置
     */
    getAll() {
        return { ...this._data };
    },

    /**
     * 获取单个设置项
     */
    get(key) {
        return this._data[key] !== undefined ? this._data[key] : this._defaults[key];
    },

    /**
     * 设置单个设置项并保存
     */
    set(key, value) {
        this._data[key] = value;
        this._save();
    },

    /**
     * 批量更新设置并保存
     */
    update(partial) {
        Object.assign(this._data, partial);
        this._save();
    },

    /**
     * 重置为默认设置
     */
    reset() {
        this._data = { ...this._defaults };
        this._save();
    },

    /**
     * 获取全局系统提示词
     */
    getGlobalSystemPrompt() {
        return this._data.globalSystemPrompt || '';
    },

    /**
     * 获取排除标签列表
     */
    getExcludeTags() {
        return this._data.excludeTags || [];
    },
};
