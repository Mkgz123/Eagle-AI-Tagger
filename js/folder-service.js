/* ============================================================
   folder-service.js - Eagle Folder / SmartFolder 操作封装
   ============================================================ */

const FolderService = {
    /**
     * 获取所有文件夹（含智能文件夹）
     */
    async getAllFolders() {
        const library = await eagle.library.info();
        return library.folders || [];
    },

    /**
     * 获取所有普通文件夹（排除智能文件夹）
     */
    async getRegularFolders() {
        const folders = await this.getAllFolders();
        return folders.filter((f) => !f.isSmart);
    },

    /**
     * 按 ID 获取文件夹
     */
    async getById(folderId) {
        return await eagle.folder.getById(folderId);
    },

    /**
     * 获取文件夹内素材
     */
    async getItems(folderId, fields) {
        return await ItemService.getByFolder(folderId, fields);
    },

    /**
     * 更新文件夹描述
     */
    async updateDescription(folder, description) {
        folder.description = description;
        return await folder.save();
    },

    /**
     * 创建文件夹
     */
    async createFolder(name, parentId) {
        return await eagle.folder.create({ name, parent: parentId || undefined });
    },

    /**
     * 分析文件夹统计数据
     * @param {string} folderId - 文件夹 ID
     * @returns {Promise<Object>} 统计结果
     */
    async analyzeFolder(folderId) {
        const items = await this.getItems(folderId);
        const folder = await this.getById(folderId);

        const stats = {
            folderName: folder.name,
            folderDescription: folder.description || '',
            totalItems: items.length,
            extDistribution: {},
            allTags: [],
            ratings: [],
            ratingDistribution: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            totalSize: 0,
        };

        for (const item of items) {
            // 格式分布
            const ext = (item.ext || 'unknown').toLowerCase();
            stats.extDistribution[ext] = (stats.extDistribution[ext] || 0) + 1;

            // 标签收集
            if (item.tags) {
                stats.allTags.push(...item.tags);
            }

            // 评分
            const rating = item.star || 0;
            stats.ratings.push(rating);
            stats.ratingDistribution[rating] = (stats.ratingDistribution[rating] || 0) + 1;

            // 大小
            if (item.size) stats.totalSize += item.size;
        }

        // 标签频率排序
        const tagFreq = Utils.countFrequency(stats.allTags);
        stats.topTags = tagFreq.slice(0, 30).map(([name, count]) => ({ name, count }));

        // 平均评分
        stats.avgRating = stats.ratings.length > 0
            ? stats.ratings.reduce((a, b) => a + b, 0) / stats.ratings.length
            : 0;

        // 清理原始数据（避免 JSON 过大）
        delete stats.allTags;
        delete stats.ratings;

        return stats;
    },

    // ========== 智能文件夹操作 ==========

    /**
     * 获取所有智能文件夹
     */
    async getAllSmartFolders() {
        try {
            return await eagle.smartFolder.getAll();
        } catch (e) {
            console.error('获取智能文件夹失败:', e);
            return [];
        }
    },

    /**
     * 获取智能文件夹筛选规则 schema
     */
    async getSmartFolderRules() {
        try {
            return await eagle.smartFolder.getRules();
        } catch (e) {
            console.error('获取智能文件夹规则失败:', e);
            return null;
        }
    },

    /**
     * 创建智能文件夹
     * @param {Object} config - { name, description, tags, match, iconColor }
     */
    async createSmartFolder(config) {
        const conditions = [{
            rules: [
                {
                    property: 'tags',
                    method: config.match === 'OR' ? 'include_any' : 'include_all',
                    value: config.tags,
                },
            ],
            match: 'AND',
        }];

        return await eagle.smartFolder.create({
            name: config.name,
            description: config.description || '',
            conditions,
            iconColor: config.iconColor || 'blue',
        });
    },

    /**
     * 批量创建智能文件夹
     */
    async createSmartFoldersBatch(suggestions) {
        const results = { success: 0, failed: 0, errors: [] };
        for (const s of suggestions) {
            try {
                await this.createSmartFolder(s);
                results.success++;
            } catch (e) {
                results.failed++;
                results.errors.push({ name: s.name, error: e.message });
            }
        }
        return results;
    },

    /**
     * 删除智能文件夹
     */
    async removeSmartFolder(id) {
        return await eagle.smartFolder.remove(id);
    },

    /**
     * 重命名文件夹
     */
    async renameFolder(folder, newName) {
        folder.name = newName;
        return await folder.save();
    },
};
