/* ============================================================
   tag-service.js - Eagle Tag / TagGroup 操作封装
   ============================================================ */

const TagService = {
    /**
     * 获取所有标签
     * @param {string} nameFilter - 按名称模糊过滤（可选）
     */
    async getAllTags(nameFilter) {
        const options = nameFilter ? { name: nameFilter } : {};
        return await eagle.tag.get(options);
    },

    /**
     * 获取最近使用的标签
     */
    async getRecentTags() {
        return await eagle.tag.getRecentTags();
    },

    /**
     * 获取收藏标签
     */
    async getStarredTags() {
        return await eagle.tag.getStarredTags();
    },

    /**
     * 获取所有标签组
     */
    async getAllTagGroups() {
        return await eagle.tagGroup.get();
    },

    /**
     * 创建标签组
     */
    async createTagGroup(name, tags, color) {
        return await eagle.tagGroup.create({ name, tags: tags || [], color: color || 'blue' });
    },

    /**
     * 合并标签
     */
    async mergeTags(source, target) {
        return await eagle.tag.merge({ source, target });
    },

    /**
     * 标签频率分析
     * @returns {Promise<Array<{name: string, count: number}>>}
     */
    async analyzeTagFrequency() {
        const tags = await this.getAllTags();
        // tags 中每个对象有 name 和 count 属性
        return tags
            .map((t) => ({ name: t.name, count: t.count || 0 }))
            .sort((a, b) => b.count - a.count);
    },

    /**
     * 获取常用标签（前 N 个）
     */
    async getTopTags(limit = 50) {
        const frequency = await this.analyzeTagFrequency();
        return frequency.slice(0, limit);
    },

    /**
     * 重命名标签
     */
    async renameTag(tag, newName) {
        tag.name = newName;
        return await tag.save();
    },

    /**
     * 搜索标签（模糊匹配）
     */
    async searchTags(keyword) {
        if (!keyword) return await this.getAllTags();
        const tags = await this.getAllTags(keyword);
        return tags;
    },

    /**
     * 构建标签统计摘要
     */
    async buildTagSummary() {
        const freq = await this.analyzeTagFrequency();
        const total = freq.reduce((sum, t) => sum + t.count, 0);
        return {
            totalUniqueTags: freq.length,
            totalTagUsage: total,
            top10: freq.slice(0, 10),
            top50: freq.slice(0, 50),
            unusedTags: freq.filter((t) => t.count === 0),
        };
    },
};
