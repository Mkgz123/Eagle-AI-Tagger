/* ============================================================
   ai-service.js - AI 服务封装
   支持两种模式：Eagle AI SDK / 自定义 OpenAI 兼容 API
   ============================================================ */

const AIService = {
    _ai: null,
    _model: null,
    _visionModel: null,
    _ready: false,

    // ========== 初始化 ==========

    init() {
        try {
            this._ai = eagle.extraModule.ai;
            this._ready = true;
        } catch (e) {
            console.error('AI SDK 初始化失败:', e);
            this._ready = false;
        }
    },

    isReady() {
        if (SettingsStore.get('apiMode') === 'custom') return true;
        return this._ready && !!this._ai;
    },

    /**
     * 检查模型是否可用
     */
    hasModel() {
        if (SettingsStore.get('apiMode') === 'custom') {
            const url = SettingsStore.get('customBaseUrl');
            const model = SettingsStore.get('customModel');
            return !!(url && model);
        }
        if (!this.isReady()) return false;
        return !!this._ai.getDefaultModel('chat');
    },

    // ========== SDK 模式 ==========

    _getModel() {
        if (!this._model) {
            const defaultLLM = this._ai.getDefaultModel('chat');
            if (!defaultLLM) return null;
            this._model = this._ai.getModel(defaultLLM);
        }
        return this._model;
    },

    _getVisionModel() {
        if (!this._visionModel) {
            const defaultVLM = this._ai.getDefaultModel('image');
            if (defaultVLM) {
                this._visionModel = this._ai.getModel(defaultVLM);
            } else {
                this._visionModel = this._getModel();
            }
        }
        return this._visionModel;
    },

    reload() {
        if (SettingsStore.get('apiMode') === 'custom') return;
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

    openSettings() {
        if (this._ready && this._ai) this._ai.open();
    },

    // ========== 自定义 API 模式 ==========

    _getCustomConfig() {
        return {
            baseUrl: (SettingsStore.get('customBaseUrl') || '').replace(/\/+$/, ''),
            apiKey: SettingsStore.get('customApiKey') || '',
            model: SettingsStore.get('customModel') || '',
        };
    },

    /**
     * 将 file:// URL 转为 base64 data URL
     */
    _fileUrlToDataUrl(fileUrl) {
        try {
            if (!fileUrl || !fileUrl.startsWith('file://')) return null;
            const fs = require('fs');
            const path = require('path');
            // Windows: file:///C:/... → C:/...
            let filePath = fileUrl.replace('file://', '');
            // 处理 URL 编码
            filePath = decodeURIComponent(filePath);
            // Windows 路径修正
            if (filePath.match(/^\/[a-zA-Z]:\//)) {
                filePath = filePath.slice(1);
            }
            if (!fs.existsSync(filePath)) return null;
            const buffer = fs.readFileSync(filePath);
            const base64 = buffer.toString('base64');
            const ext = path.extname(filePath).toLowerCase().replace('.', '');
            const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml' };
            const mime = mimeMap[ext] || 'image/png';
            return `data:${mime};base64,${base64}`;
        } catch (e) {
            console.error('图片转 base64 失败:', e);
            return null;
        }
    },

    /**
     * 自定义 API: 文本生成
     */
    async _customGenerateText(systemPrompt, userPrompt, useVision, imageUrl) {
        const config = this._getCustomConfig();
        if (!config.baseUrl || !config.model) {
            throw new Error('请先在设置中配置自定义 API 地址和模型名称');
        }

        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }

        if (useVision && imageUrl) {
            const content = [];
            if (userPrompt) content.push({ type: 'text', text: userPrompt });
            const dataUrl = this._fileUrlToDataUrl(imageUrl);
            if (dataUrl) {
                content.push({ type: 'image_url', image_url: { url: dataUrl } });
            }
            messages.push({ role: 'user', content });
        } else {
            messages.push({ role: 'user', content: userPrompt });
        }

        const headers = { 'Content-Type': 'application/json' };
        if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

        const res = await fetch(`${config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: config.model,
                messages,
                temperature: 0.7,
                max_tokens: 4096,
            }),
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
        }

        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
    },

    /**
     * 自定义 API: 结构化对象生成
     */
    async _customGenerateObject(systemPrompt, userPrompt, schema, useVision, imageUrl) {
        const config = this._getCustomConfig();
        if (!config.baseUrl || !config.model) {
            throw new Error('请先在设置中配置自定义 API 地址和模型名称');
        }

        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }

        // 将 schema 要求追加到 user prompt 中
        const schemaHint = `\n\n请严格按照以下 JSON 格式返回，不要包含任何其他文字：\n${JSON.stringify(schema, null, 2)}`;
        const fullPrompt = userPrompt + schemaHint;

        if (useVision && imageUrl) {
            const content = [];
            content.push({ type: 'text', text: fullPrompt });
            const dataUrl = this._fileUrlToDataUrl(imageUrl);
            if (dataUrl) {
                content.push({ type: 'image_url', image_url: { url: dataUrl } });
            }
            messages.push({ role: 'user', content });
        } else {
            messages.push({ role: 'user', content: fullPrompt });
        }

        const headers = { 'Content-Type': 'application/json' };
        if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

        const res = await fetch(`${config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: config.model,
                messages,
                temperature: 0.3,
                max_tokens: 4096,
                response_format: { type: 'json_object' },
            }),
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
        }

        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '{}';
        try {
            // 尝试提取 JSON（有些模型会在 JSON 外包裹 markdown）
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            return JSON.parse(jsonMatch ? jsonMatch[0] : text);
        } catch (e) {
            throw new Error('AI 返回了非 JSON 格式的内容: ' + text.slice(0, 100));
        }
    },

    // ========== 通用调用（自动路由 SDK / 自定义） ==========

    _isCustomMode() {
        return SettingsStore.get('apiMode') === 'custom';
    },

    async _generateText(systemPrompt, userPrompt, useVision = false, imageUrl = null) {
        if (this._isCustomMode()) {
            return await this._customGenerateText(systemPrompt, userPrompt, useVision, imageUrl);
        }

        // === Eagle SDK 模式 ===
        if (!this.isReady()) throw new Error('AI SDK 不可用');
        if (!this.hasModel()) throw new Error('请先在 Eagle 偏好设置中配置 AI 模型');

        const model = useVision ? this._getVisionModel() : this._getModel();
        if (!model) throw new Error('无法获取 AI 模型');

        let messages;
        if (useVision && imageUrl) {
            messages = [];
            const sp = systemPrompt || SettingsStore.getGlobalSystemPrompt();
            if (sp) messages.push({ role: 'system', content: sp });
            const content = [];
            if (userPrompt) content.push({ type: 'text', text: userPrompt });
            if (imageUrl) content.push({ type: 'image', image: imageUrl });
            messages.push({ role: 'user', content });
        } else {
            messages = this._buildMessages(systemPrompt, userPrompt);
        }

        const { generateText } = this._ai;
        const result = await generateText({ model, messages });
        return result.text;
    },

    async _generateObject(systemPrompt, userPrompt, schema, useVision = false, imageUrl = null) {
        if (this._isCustomMode()) {
            return await this._customGenerateObject(systemPrompt, userPrompt, schema, useVision, imageUrl);
        }

        // === Eagle SDK 模式 ===
        if (!this.isReady()) throw new Error('AI SDK 不可用');
        if (!this.hasModel()) throw new Error('请先在 Eagle 偏好设置中配置 AI 模型');

        const model = useVision ? this._getVisionModel() : this._getModel();
        if (!model) throw new Error('无法获取 AI 模型');

        let messages;
        if (useVision && imageUrl) {
            messages = [];
            const sp = systemPrompt || SettingsStore.getGlobalSystemPrompt();
            if (sp) messages.push({ role: 'system', content: sp });
            const content = [];
            if (userPrompt) content.push({ type: 'text', text: userPrompt });
            if (imageUrl) content.push({ type: 'image', image: imageUrl });
            messages.push({ role: 'user', content });
        } else {
            messages = this._buildMessages(systemPrompt, userPrompt);
        }

        const { generateObject } = this._ai;
        const result = await generateObject({ model, schema, messages });
        return result.object;
    },

    _buildMessages(systemPrompt, userContent) {
        const messages = [];
        const sp = systemPrompt || SettingsStore.getGlobalSystemPrompt();
        if (sp) {
            messages.push({ role: 'system', content: sp });
        }
        messages.push({ role: 'user', content: userContent });
        return messages;
    },

    // ========== 业务方法 ==========

    /**
     * 生成素材描述
     */
    async generateDescription(item, instruction, systemPrompt, useExistingDesc = false) {
        const imageUrl = item.thumbnailURL || item.fileURL;
        const ext = (item.ext || '').toLowerCase();
        const useVision = Utils.isImage(ext) && !!imageUrl;

        const prompt = instruction || '请用简洁的语言描述这个素材的内容。';
        const existingAnnotation = (item.annotation || '').trim();

        if (useVision) {
            let fullPrompt = prompt;
            if (useExistingDesc && existingAnnotation) {
                fullPrompt = `现有描述：${existingAnnotation}\n\n请参考以上现有描述，根据以下指令重新生成描述：\n${prompt}`;
            }
            return await this._generateText(systemPrompt, fullPrompt, true, imageUrl);
        } else {
            const context = [
                `文件名: ${item.name || '未知'}`,
                `格式: ${ext || '未知'}`,
                existingAnnotation ? `现有描述: ${existingAnnotation}` : '',
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
                tags: { type: 'array', items: { type: 'string' }, description: '生成的标签列表' },
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
                rating: { type: 'integer', minimum: 0, maximum: 5, description: '评分 0-5（整数）' },
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
     * 分析文件夹内容并生成描述
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

    // ========== 连通性测试 ==========

    async testConnection() {
        if (this._isCustomMode()) {
            const config = this._getCustomConfig();
            if (!config.baseUrl || !config.model) {
                return { ok: false, error: '请先配置自定义 API 地址和模型名称' };
            }
            try {
                const headers = { 'Content-Type': 'application/json' };
                if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

                const res = await fetch(`${config.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        model: config.model,
                        messages: [{ role: 'user', content: 'Reply with "OK"' }],
                        max_tokens: 10,
                    }),
                });

                if (!res.ok) {
                    const errText = await res.text().catch(() => '');
                    // 尝试解析错误 JSON
                    let errMsg = errText.slice(0, 300);
                    try {
                        const errJson = JSON.parse(errText);
                        errMsg = errJson.error?.message || errJson.message || errMsg;
                    } catch (_) {}
                    return { ok: false, error: `API ${res.status}: ${errMsg}` };
                }
                return { ok: true };
            } catch (e) {
                return { ok: false, error: this.formatError(e) };
            }
        }

        // === Eagle SDK 模式 ===
        if (!this.isReady()) return { ok: false, error: 'AI SDK 不可用' };
        if (!this.hasModel()) return { ok: false, error: '请先在 Eagle 偏好设置中配置 AI 模型' };

        const model = this._getModel();
        if (!model) return { ok: false, error: '无法获取 AI 模型实例' };

        try {
            const { generateText } = this._ai;
            await generateText({ model, prompt: 'Reply with just "OK".' });
            return { ok: true };
        } catch (e) {
            return { ok: false, error: this.formatError(e) };
        }
    },

    // ========== 错误处理 ==========

    formatError(error) {
        const msg = error.message || '';
        if (msg.includes('ECONNREFUSED') || msg.includes('Connection refused') || msg.includes('connect')) {
            return '无法连接到 AI 服务，请确认服务已启动（LM Studio 默认端口 1234）';
        }
        if (msg.includes('ECONNRESET') || msg.includes('socket') || msg.includes('Network')) {
            return 'AI 服务连接中断，请检查服务是否正常运行';
        }
        if (msg.includes('timeout') || msg.includes('TIMEDOUT') || msg.includes('ETIMEDOUT')) {
            return 'AI 服务响应超时，模型可能正在加载中，请稍后重试';
        }
        if (msg.includes('model not found') || msg.includes('Model not found') || msg.includes('404')) {
            return '模型未找到，请确认模型名称正确且已加载';
        }
        if (msg.includes('401') || msg.includes('Unauthorized')) {
            return 'API 认证失败，请检查 API Key 是否正确';
        }
        if (msg.includes('429') || msg.includes('Too Many Requests')) {
            return 'API 请求频率过高，请稍后重试';
        }
        if (msg.includes('500') || msg.includes('Internal Server Error')) {
            return 'AI 服务内部错误，请稍后重试';
        }
        if (msg.includes('Failed to fetch') || msg.includes('fetch')) {
            return '无法连接到 AI 服务，请确认 API 地址正确且服务已启动';
        }
        return msg || '未知 AI 错误';
    },
};
