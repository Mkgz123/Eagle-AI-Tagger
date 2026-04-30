/* ============================================================
   item-service.js - Eagle Item 操作封装
   提供素材的读取、修改、批量处理功能
   ============================================================ */

const ItemService = {
    /**
     * 获取当前选中的素材
     * @param {string[]} fields - 需要返回的字段
     * @returns {Promise<Array>}
     */
    async getSelectedItems(fields) {
        const options = { isSelected: true };
        if (fields) options.fields = fields;
        return await eagle.item.get(options);
    },

    /**
     * 按 ID 获取素材
     */
    async getById(id) {
        return await eagle.item.getById(id);
    },

    /**
     * 按文件夹获取素材
     * @param {string} folderId - 文件夹 ID
     * @param {string[]} fields - 需要返回的字段
     * @returns {Promise<Array>}
     */
    async getByFolder(folderId, fields) {
        const options = { folders: [folderId] };
        if (fields) options.fields = fields;
        return await eagle.item.get(options);
    },

    /**
     * 获取选中素材数量
     */
    async getSelectedCount() {
        return await eagle.item.count({ isSelected: true });
    },

    /**
     * 更新素材描述
     * @param {Object} item - Eagle Item 实例
     * @param {string} text - 新的描述文本
     * @param {string} mode - 'overwrite' | 'append'
     */
    async updateAnnotation(item, text, mode) {
        if (!text) return;

        if (mode === 'append') {
            const existing = (item.annotation || '').trim();
            item.annotation = existing ? existing + '\n\n' + text : text;
        } else {
            item.annotation = text;
        }

        return await item.save();
    },

    /**
     * 更新素材标签
     * @param {Object} item - Eagle Item 实例
     * @param {string[]} newTags - 新标签列表
     * @param {string} mode - 'merge' | 'replace'
     * @param {string[]} excludeTags - 要排除的标签（在清理时保留的标签不会被移除）
     */
    async updateTags(item, newTags, mode, excludeTags) {
        if (!newTags || newTags.length === 0) return;

        const exclude = excludeTags || SettingsStore.getExcludeTags();
        const excludeSet = new Set(exclude.map((t) => t.toLowerCase()));

        if (mode === 'merge') {
            // 合并模式：保留现有标签中在排除列表中的，加入新标签
            const existing = (item.tags || []).filter((t) => excludeSet.has(t.toLowerCase()));
            const merged = [...new Set([...existing, ...newTags])];
            item.tags = merged;
        } else {
            // 替换模式：保留排除列表中的标签，其他全部替换为新标签
            const keepTags = (item.tags || []).filter((t) => excludeSet.has(t.toLowerCase()));
            const combined = [...new Set([...keepTags, ...newTags])];
            item.tags = combined;
        }

        return await item.save();
    },

    /**
     * 完全替换标签（清理模式：排除指定标签后替换）
     * @param {Object} item - Eagle Item 实例
     * @param {string[]} newTags - 新标签
     * @param {string[]} excludeTags - 不被清理的标签
     */
    async replaceTagsWithExclude(item, newTags, excludeTags) {
        const exclude = excludeTags || [];
        const excludeSet = new Set(exclude.map((t) => t.toLowerCase()));
        const keepTags = (item.tags || []).filter((t) => excludeSet.has(t.toLowerCase()));
        item.tags = [...new Set([...keepTags, ...newTags])];
        return await item.save();
    },

    /**
     * 更新素材评分
     * @param {Object} item - Eagle Item 实例
     * @param {number} rating - 评分 0-5
     */
    async updateRating(item, rating) {
        const r = Math.max(0, Math.min(5, Math.round(rating)));
        item.star = r;
        return await item.save();
    },

    /**
     * 重命名素材
     * @param {Object} item - Eagle Item 实例
     * @param {string} newName - 新文件名（不含扩展名）
     */
    async renameItem(item, newName) {
        if (!newName || newName === item.name) return;
        const ext = item.ext || Utils.getExt(item.name);
        item.name = ext ? `${newName}.${ext}` : newName;
        return await item.save();
    },

    /**
     * 批量处理素材（顺序执行）
     * @param {Array} items - 素材列表
     * @param {Function} action - 对单个素材执行的操作，返回 Promise
     * @param {Function} onProgress - 进度回调 (current, total, item)
     * @returns {Promise<{success: number, failed: number, errors: Array}>}
     */
    async batchProcess(items, action, onProgress) {
        const total = items.length;
        let success = 0;
        let failed = 0;
        const errors = [];

        for (let i = 0; i < total; i++) {
            const item = items[i];
            try {
                await action(item);
                success++;
            } catch (e) {
                failed++;
                errors.push({ item: item.name || item.id, error: e.message });
            }
            if (onProgress) {
                onProgress(i + 1, total, item);
            }
        }

        return { success, failed, errors };
    },

    /**
     * 构建素材的上下文信息字符串
     */
    buildItemContext(item) {
        const parts = [
            `名称: ${item.name || '未知'}`,
            `格式: ${(item.ext || '').toUpperCase()}`,
            `描述: ${item.annotation || '无'}`,
            `标签: ${(item.tags || []).join(', ') || '无'}`,
            `评分: ${'★'.repeat(item.star || 0)}${'☆'.repeat(5 - (item.star || 0))}`,
        ];
        if (item.width && item.height) {
            parts.push(`尺寸: ${item.width}x${item.height}`);
        }
        if (item.size) {
            parts.push(`大小: ${Utils.formatSize(item.size)}`);
        }
        return parts.join('\n');
    },
};
