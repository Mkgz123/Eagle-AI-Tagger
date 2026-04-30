/* ============================================================
   Eagle AI Tagger - 通用工具函数
   ============================================================ */

const Utils = {
    /**
     * 防抖
     */
    debounce(fn, delay = 300) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    },

    /**
     * 生成唯一 ID（简短）
     */
    uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    },

    /**
     * 格式化日期时间
     */
    formatDate(timestamp) {
        if (!timestamp) return '';
        const d = new Date(timestamp);
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },

    /**
     * 格式化文件大小
     */
    formatSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
    },

    /**
     * 简单 HTML 转义
     */
    escapeHtml(str) {
        if (!str) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return String(str).replace(/[&<>"']/g, (c) => map[c]);
    },

    /**
     * 截断文本
     */
    truncate(str, maxLen = 80) {
        if (!str || str.length <= maxLen) return str || '';
        return str.slice(0, maxLen) + '...';
    },

    /**
     * 星星显示
     */
    renderStars(rating) {
        const r = Math.max(0, Math.min(5, parseInt(rating) || 0));
        return '★'.repeat(r) + '☆'.repeat(5 - r);
    },

    /**
     * 获取文件扩展名
     */
    getExt(filename) {
        if (!filename) return '';
        const i = filename.lastIndexOf('.');
        return i >= 0 ? filename.slice(i + 1).toLowerCase() : '';
    },

    /**
     * 判断是否为图片文件
     */
    isImage(ext) {
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'ico', 'heic', 'avif'];
        return imageExts.includes(ext.toLowerCase());
    },

    /**
     * 判断是否为视频文件
     */
    isVideo(ext) {
        const videoExts = ['mp4', 'mov', 'avi', 'webm', 'mkv', 'flv', 'wmv', 'm4v'];
        return videoExts.includes(ext.toLowerCase());
    },

    /**
     * 元素显示/隐藏
     */
    show(el) { if (el) el.style.display = ''; },
    hide(el) { if (el) el.style.display = 'none'; },
    toggle(el) {
        if (!el) return;
        el.style.display = el.style.display === 'none' ? '' : 'none';
    },

    /**
     * 设置元素内容（安全）
     */
    setHtml(el, html) {
        if (el) el.innerHTML = html;
    },

    /**
     * 添加/移除 CSS 类
     */
    addClass(el, cls) { if (el) el.classList.add(cls); },
    removeClass(el, cls) { if (el) el.classList.remove(cls); },
    toggleClass(el, cls) { if (el) el.classList.toggle(cls); },

    /**
     * 从数组中统计频率
     */
    countFrequency(arr) {
        const freq = {};
        for (const item of arr) {
            freq[item] = (freq[item] || 0) + 1;
        }
        return Object.entries(freq).sort((a, b) => b[1] - a[1]);
    },
};
