/* ============================================================
   ai-service.js - Eagle AI SDK 封装
   统一处理 AI 调用、错误处理、结果解析
   ============================================================ */

const AIService = {
    _ai: null,
    _model: null,
    _visionModel: null,
    _ready: false,

    /**
     * 初始化 AI SDK
     */
    init() {
        try {
            this._ai = eagle.extraModule.ai;
            this._ready = true;
        } catch (e) {
            console.error('AI SDK 初始化失败:', e);
            this._ready = false;
        }
    },

    /**
     * AI SDK 是否可用
     */
    isReady() {
        return this._ready && !!this._ai;
    },

    /**
     * 检查模型是否已配置
     */
    hasModel() {
        if (!this.isReady()) return false;
        return !!this._ai.getDefaultModel('chat');
    },

    /**
     * 获取文本模型
     */
    _getModel() {
        if (!this._model) {
            const defaultLLM = this._ai.getDefaultModel('chat');
            if (!defaultLLM) return null;
            this._model = this._ai.getModel(defaultLLM);
        }
        return this._model;
    },

    /**
     * 获取视觉模型
     */
    _getVisionModel() {
        if (!this._visionModel) {
            // 优先使用视觉模型，没有则回退到文本模型
            const defaultVLM = this._ai.getDefaultModel('image');
            if (defaultVLM) {
                this._visionModel = this._ai.getModel(defaultVLM);
            } else {
                this._visionModel = this._getModel();
            }
        }
        return this._visionModel;
    },

    /**
     * 重新加载模型（用户更换模型后调用）
     */
    reload() {
        if (!this.isReady()) return;
        this._ai.reload();
        this._model = null;
        this._visionModel = null;
        const defaultLLM = this._ai.getDefaultModel('chat');
        if (defaultLLM) {
            this._model = this._ai.getModel(defaultLLM);
        }
        const defaultVLM = this._ai.getDefaultModel('image');
        if (defaultVLM) {
            this._visionModel = this._ai.getModel(defaultVLM);
        }
    },

    /**
     * 打开 AI SDK 设置
     */
    openSettings() {
        if (this.isReady()) this._ai.open();
    },

    /**
     * 构建消息列表
     */
    _buildMessages(systemPrompt, userContent) {
        const messages = [];
        const sp = systemPrompt || SettingsStore.getGlobalSystemPrompt();
        if (sp) {
            messages.push({ role: 'system', content: sp });
        }
        messages.push({ role: 'user', content: userContent });
        return messages;
    },

    /**
     * 构建带图片的用户消息内容
     */
    _buildImageContent(text, imageUrl) {
        const content = [];
        if (text) {
            content.push({ type: 'text', text });
        }
        if (imageUrl) {
            content.push({ type: 'image', image: imageUrl });
        }
        return content;
    },

    /**
     * 通用 AI 文本生成
     */
    async _generateText(systemPrompt, userPrompt, useVision = false, imageUrl = null) {
        if (!this.isReady()) throw new Error('AI SDK 不可用');
        if (!this.hasModel()) throw new Error('请先在 Eagle 偏好设置中配置 AI 模型');

        const model = useVision ? this._getVisionModel() : this._getModel();
        if (!model) throw new Error('无法获取 AI 模型');

        let messages;
        if (useVision && imageUrl) {
            messages = [];
            if (systemPrompt || SettingsStore.getGlobalSystemPrompt()) {
                messages.push({
                    role: 'system',
                    content: systemPrompt || SettingsStore.getGlobalSystemPrompt(),
                });
            }
            messages.push({
                role: 'user',
                content: this._buildImageContent(userPrompt, imageUrl),
            });
        } else {
            messages = this._buildMessages(systemPrompt, userPrompt);
        }

        const { generateText } = this._ai;
        const result = await generateText({ model, messages });
        return result.text;
    },

    /**
     * 通用 AI 结构化对象生成
     */
    async _generateObject(systemPrompt, userPrompt, schema, useVision = false, imageUrl = null) {
        if (!this.isReady()) throw new Error('AI SDK 不可用');
        if (!this.hasModel()) throw new Error('请先在 Eagle 偏好设置中配置 AI 模型');

        const model = useVision ? this._getVisionModel() : this._getModel();
        if (!model) throw new Error('无法获取 AI 模型');

        let messages;
        if (useVision && imageUrl) {
            messages = [];
            if (systemPrompt || SettingsStore.getGlobalSystemPrompt()) {
                messages.push({
                    role: 'system',
                    content: systemPrompt || SettingsStore.getGlobalSystemPrompt(),
                });
            }
            messages.push({
                role: 'user',
                content: this._buildImageContent(userPrompt, imageUrl),
            });
        } else {
            messages = this._buildMessages(systemPrompt, userPrompt);
        }

        const { generateObject } = this._ai;
        const result = await generateObject({ model, schema, messages });
        return result.object;
    },

    // ========== 业务方法 ==========

    /**
     * 生成素材描述
     * @param {Object} item - Eagle Item 实例
     * @param {string} instruction - 用户指令
     * @param {string} systemPrompt - 系统提示词（可选，覆盖全局）
     * @returns {Promise<string>} 生成的描述文本
     */
    async generateDescription(item, instruction, systemPrompt) {
        const imageUrl = item.thumbnailURL || item.fileURL;
        const ext = (item.ext || '').toLowerCase();
        const useVision = Utils.isImage(ext) && !!imageUrl;

        const prompt = instruction || '请用简洁的语言描述这个素材的内容。';

        if (useVision) {
            return await this._generateText(systemPrompt, prompt, true, imageUrl);
        } else {
            // 对于非图片素材，基于文件名和现有描述生成
            const context = [
                `文件名: ${item.name || '未知'}`,
                `格式: ${ext || '未知'}`,
                `现有描述: ${item.annotation || '无'}`,
                item.width && item.height ? `尺寸: ${item.width}x${item.height}` : '',
            ].filter(Boolean).join('\n');

            return await this._generateText(
                systemPrompt,
                `基于以下素材信息：\n${context}\n\n${prompt}`,
                false
            );
        }
    },

    /**
     * 生成标签
     * @param {Object} item - Eagle Item 实例
     * @param {string} instruction - 用户指令
     * @param {string} systemPrompt - 系统提示词
     * @param {string[]} existingTags - 现有标签列表
     * @returns {Promise<{tags: string[], reason: string}>}
     */
    async generateTags(item, instruction, systemPrompt, existingTags) {
        const imageUrl = item.thumbnailURL || item.fileURL;
        const ext = (item.ext || '').toLowerCase();
        const useVision = Utils.isImage(ext) && !!imageUrl;

        const prompt = [
            instruction || '请为这个素材生成合适的标签。',
            existingTags && existingTags.length > 0
                ? `\n当前标签: ${existingTags.join(', ')}`
                : '',
            '\n请以 JSON 格式返回，格式为: {"tags": ["标签1", "标签2", ...], "reason": "生成理由简述"}',
        ].join('');

        const schema = {
            type: 'object',
            properties: {
                tags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '生成的标签列表',
                },
                reason: { type: 'string', description: '生成这些标签的理由' },
            },
            required: ['tags'],
        };

        if (useVision) {
            return await this._generateObject(systemPrompt, prompt, schema, true, imageUrl);
        } else {
            const context = [
                `文件名: ${item.name || '未知'}`,
                `现有描述: ${item.annotation || '无'}`,
            ].join('\n');
            return await this._generateObject(
                systemPrompt,
                `基于以下素材信息：\n${context}\n\n${prompt}`,
                schema,
                false
            );
        }
    },

    /**
     * 生成评分
     * @param {Object} item - Eagle Item 实例
     * @param {string} instruction - 用户指令
     * @param {string} systemPrompt - 系统提示词
     * @returns {Promise<{rating: number, reason: string}>}
     */
    async generateRating(item, instruction, systemPrompt) {
        const imageUrl = item.thumbnailURL || item.fileURL;
        const ext = (item.ext || '').toLowerCase();
        const useVision = Utils.isImage(ext) && !!imageUrl;

        const prompt = [
            instruction || '请对这张图片从构图、色彩、创意、技术质量等维度进行评分，给出1-5星的综合评分（只能是1、2、3、4、5的整数）。',
            '\n请以 JSON 格式返回，格式为: {"rating": 4, "reason": "评分理由简述"}',
        ].join('');

        const schema = {
            type: 'object',
            properties: {
                rating: {
                    type: 'integer',
                    minimum: 0,
                    maximum: 5,
                    description: '评分 0-5（整数）',
                },
                reason: { type: 'string', description: '评分理由' },
            },
            required: ['rating'],
        };

        if (useVision) {
            return await this._generateObject(systemPrompt, prompt, schema, true, imageUrl);
        } else {
            const context = `文件名: ${item.name || '未知'}\n现有描述: ${item.annotation || '无'}`;
            return await this._generateObject(
                systemPrompt,
                `基于以下素材信息：\n${context}\n\n${prompt}`,
                schema,
                false
            );
        }
    },

    /**
     * 综合标注（描述 + 标签 + 评分）
     * @returns {Promise<{description: string, tags: string[], rating: number, reason: string}>}
     */
    async generateComprehensive(item, instruction, systemPrompt) {
        const imageUrl = item.thumbnailURL || item.fileURL;
        const ext = (item.ext || '').toLowerCase();
        const useVision = Utils.isImage(ext) && !!imageUrl;

        const prompt = [
            instruction || '请对这个素材进行全面分析，包括：描述、标签、评分。',
            '\n请以 JSON 格式返回：{"description": "描述内容", "tags": ["标签1", ...], "rating": 4, "reason": "综合评估"}',
        ].join('');

        const schema = {
            type: 'object',
            properties: {
                description: { type: 'string', description: '素材描述' },
                tags: { type: 'array', items: { type: 'string' }, description: '标签列表' },
                rating: { type: 'integer', minimum: 0, maximum: 5, description: '评分 0-5' },
                reason: { type: 'string', description: '分析总结' },
            },
            required: ['description', 'tags', 'rating'],
        };

        if (useVision) {
            return await this._generateObject(systemPrompt, prompt, schema, true, imageUrl);
        } else {
            const context = [
                `文件名: ${item.name || '未知'}`,
                `格式: ${ext || '未知'}`,
                `现有描述: ${item.annotation || '无'}`,
                `现有标签: ${(item.tags || []).join(', ') || '无'}`,
            ].join('\n');
            return await this._generateObject(
                systemPrompt,
                `基于以下素材信息：\n${context}\n\n${prompt}`,
                schema,
                false
            );
        }
    },

    /**
     * 分析文件夹内容并生成描述
     * @param {Object} stats - 文件夹统计数据
     * @param {string} instruction - 用户指令
     * @param {string} systemPrompt - 系统提示词
     * @returns {Promise<string>} 文件夹描述
     */
    async analyzeFolder(stats, instruction, systemPrompt) {
        const prompt = [
            instruction || '请根据以下文件夹的素材统计数据，生成一个简洁的文件夹概述描述。',
            '\n文件夹统计信息：',
            `- 素材总数: ${stats.totalItems}`,
            `- 文件格式分布: ${JSON.stringify(stats.extDistribution)}`,
            `- 常用标签 (Top 20): ${JSON.stringify(stats.topTags)}`,
            `- 平均评分: ${stats.avgRating ? stats.avgRating.toFixed(1) : '未评分'}`,
            `- 评分分布: ${JSON.stringify(stats.ratingDistribution)}`,
            stats.folderName ? `- 文件夹名: ${stats.folderName}` : '',
            '\n请用一段文字概述这个文件夹的主题、内容和特点。',
        ].join('\n');

        return await this._generateText(systemPrompt, prompt, false);
    },

    /**
     * 根据常用标签建议智能文件夹
     * @param {Array} tagFrequency - 标签频率列表 [{name, count}, ...]
     * @param {string} systemPrompt - 系统提示词
     * @returns {Promise<Array>} 智能文件夹建议列表
     */
    async suggestSmartFolders(tagFrequency, systemPrompt) {
        const prompt = [
            '以下是资源库中的常用标签及其使用频率：',
            JSON.stringify(tagFrequency.slice(0, 50)),
            '\n请根据这些标签建议3-6个智能文件夹分组方案。',
            '每个智能文件夹应包含：名称、描述、筛选条件（用哪些标签筛选，AND/OR逻辑）。',
            '返回 JSON 数组格式：',
            '[{"name": "文件夹名", "description": "描述", "tags": ["标签1"], "match": "AND"}]',
        ].join('\n');

        const schema = {
            type: 'object',
            properties: {
                suggestions: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            description: { type: 'string' },
                            tags: { type: 'array', items: { type: 'string' } },
                            match: { type: 'string', enum: ['AND', 'OR'] },
                            iconColor: { type: 'string' },
                        },
                        required: ['name', 'tags', 'match'],
                    },
                },
            },
            required: ['suggestions'],
        };

        const result = await this._generateObject(systemPrompt, prompt, schema, false);
        return result.suggestions || [];
    },

    /**
     * AI 生成文件名
     * @param {Object} item - Eagle Item
     * @param {string} pattern - 命名模式
     * @param {string} systemPrompt - 系统提示词
     * @returns {Promise<string>} 新文件名
     */
    async generateFilename(item, pattern, systemPrompt) {
        const prompt = [
            `请根据素材内容和命名规则生成文件名。`,
            `命名规则: ${pattern}`,
            `原始文件名: ${item.name}`,
            `现有描述: ${item.annotation || '无'}`,
            `现有标签: ${(item.tags || []).join(', ') || '无'}`,
            '请只返回生成的文件名（不含扩展名），不要包含任何其他文字。',
        ].join('\n');

        const imageUrl = item.thumbnailURL || item.fileURL;
        const ext = (item.ext || '').toLowerCase();
        const useVision = Utils.isImage(ext) && !!imageUrl;

        return await this._generateText(systemPrompt, prompt, useVision, imageUrl);
    },

    /**
     * 格式化 APIError 为中文消息
     */
    formatError(error) {
        if (error.message?.includes('APIError')) {
            // 尝试解析
            if (error.status === 401) return 'API 密钥无效，请检查 AI 模型设置';
            if (error.status === 429) return 'API 请求频率过高，请稍后重试';
            if (error.status === 500) return 'AI 服务内部错误，请稍后重试';
            return `AI 服务错误: ${error.message}`;
        }
        if (error.message?.includes('Network error')) return '网络连接失败，请检查网络';
        return error.message || '未知 AI 错误';
    },
};
