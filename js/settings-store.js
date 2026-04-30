/* ============================================================
   settings-store.js - 全局设置持久化
   存储位置：优先插件目录/data/settings.json，失败时回退到临时目录
   ============================================================ */

const SettingsStore = {
    _data: null,
    _filePath: null,
    _fs: null,

    _defaults: {
        globalSystemPrompt: '',
        defaultAction: 'description',
        excludeTags: [],
        autoCleanTags: false,
        tagOverwriteMode: 'merge',
        descOverwriteMode: 'overwrite',
        ratingThreshold: 3,
        language: 'zh',
        lastRenamePattern: '',
    },

    init(pluginPath) {
        this._fs = require('fs');
        const path = require('path');

        // 主路径：插件目录
        const primaryPath = path.join(pluginPath, 'data', 'settings.json');

        // 尝试主路径
        try {
            const dir = path.dirname(primaryPath);
            if (!this._fs.existsSync(dir)) {
                this._fs.mkdirSync(dir, { recursive: true });
            }
            // 测试写入权限
            this._fs.writeFileSync(path.join(dir, '.write_test'), 'ok', 'utf-8');
            this._fs.unlinkSync(path.join(dir, '.write_test'));
            this._filePath = primaryPath;
        } catch (e) {
            // 回退到系统临时目录
            try {
                const tmpdir = require('os').tmpdir();
                const fallbackDir = path.join(tmpdir, 'eagle-ai-tagger');
                if (!this._fs.existsSync(fallbackDir)) {
                    this._fs.mkdirSync(fallbackDir, { recursive: true });
                }
                this._filePath = path.join(fallbackDir, 'settings.json');
                console.warn('设置存储回退到临时目录:', this._filePath);
            } catch (e2) {
                console.error('无法创建设置存储路径:', e2);
                this._data = { ...this._defaults };
                return;
            }
        }

        this._load();
    },

    _load() {
        try {
            if (this._fs.existsSync(this._filePath)) {
                const raw = this._fs.readFileSync(this._filePath, 'utf-8');
                const parsed = JSON.parse(raw);
                // 合并默认值，确保新字段有默认值
                this._data = { ...this._defaults, ...parsed };
            } else {
                this._data = { ...this._defaults };
                this._save();
            }
            console.log('设置已加载:', this._filePath);
        } catch (e) {
            console.error('加载设置失败:', e);
            this._data = { ...this._defaults };
        }
    },

    _save() {
        try {
            const dir = require('path').dirname(this._filePath);
            if (!this._fs.existsSync(dir)) {
                this._fs.mkdirSync(dir, { recursive: true });
            }
            this._fs.writeFileSync(this._filePath, JSON.stringify(this._data, null, 2), 'utf-8');
            console.log('设置已保存:', this._filePath);
        } catch (e) {
            console.error('保存设置失败:', e.message);
            throw new Error('保存设置失败: ' + e.message);
        }
    },

    getAll() {
        return { ...this._data };
    },

    get(key) {
        return this._data[key] !== undefined ? this._data[key] : this._defaults[key];
    },

    set(key, value) {
        this._data[key] = value;
        this._save();
    },

    update(partial) {
        Object.assign(this._data, partial);
        this._save();
    },

    reset() {
        this._data = { ...this._defaults };
        this._save();
    },

    getGlobalSystemPrompt() {
        return this._data.globalSystemPrompt || '';
    },

    getExcludeTags() {
        return this._data.excludeTags || [];
    },
};
