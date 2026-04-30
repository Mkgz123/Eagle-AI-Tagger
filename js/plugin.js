/* ============================================================
   plugin.js - Eagle 插件生命周期入口（无边框窗口版）
   ============================================================ */

/**
 * 全局状态栏引用（供 App 使用）
 */
const UI = {
    _statusEl: null,

    setStatus(text) {
        // 状态文字显示在标题栏中
        if (!this._statusEl) {
            this._statusEl = document.createElement('span');
            this._statusEl.style.cssText = 'font-size:11px;color:var(--text-muted);margin-left:12px;';
            document.querySelector('.title-bar-left')?.appendChild(this._statusEl);
        }
        if (this._statusEl) this._statusEl.textContent = text;
    },

    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    showModal(title, bodyHtml, footerHtml) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = bodyHtml || '';
        document.getElementById('modal-footer').innerHTML = footerHtml || '';
        document.getElementById('modal-overlay').classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
    },
};

// ========== 生命周期 ==========

eagle.onPluginCreate(async (plugin) => {
    console.log('AI Tagger 初始化...');
    console.log('插件路径:', plugin.path);

    // 1. 初始化数据存储
    try {
        SettingsStore.init(plugin.path);
        TemplateStore.init(plugin.path);
        console.log('数据存储就绪');
    } catch (e) {
        console.error('存储初始化失败:', e);
    }

    // 2. 初始化 AI SDK
    try {
        AIService.init();
        if (AIService.isReady()) {
            console.log('AI SDK 已就绪');
            UI.setStatus(AIService.hasModel() ? 'AI 就绪' : '请配置 AI 模型');
        } else {
            console.warn('AI SDK 不可用');
            UI.setStatus('AI SDK 不可用');
        }
    } catch (e) {
        console.error('AI SDK 初始化失败:', e);
    }

    // 3. 初始化应用
    App.init();

    // 4. 刷新选中素材
    await App.refreshSelection();
});

eagle.onPluginRun(async () => {
    console.log('eagle.onPluginRun');
    AIService.reload();
    await App.refreshSelection();
    App._renderTemplateBar();
});

eagle.onPluginShow(async () => {
    console.log('eagle.onPluginShow');
    await App.refreshSelection();
});

eagle.onPluginHide(() => {
    console.log('eagle.onPluginHide');
});

eagle.onPluginBeforeExit(() => {
    console.log('eagle.onPluginBeforeExit');
});
