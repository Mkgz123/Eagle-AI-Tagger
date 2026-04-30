# Eagle AI Tagger

Eagle 插件 - 基于 AI SDK 的智能素材标注工具。

## 功能

- **智能描述**：使用 AI Vision 模型分析素材图片，自动生成 / 追加描述
- **标签生成**：AI 提取精准标签，支持排除保护的标签清理
- **质量评分**：AI 评估素材质量并给出 1-5 星评分
- **综合分析**：一键完成描述 + 标签 + 评分
- **文件夹分析**：读取文件夹内素材统计，AI 生成文件夹描述
- **智能文件夹**：分析资源库标签，AI 建议并创建智能文件夹
- **智能重命名**：支持变量模板和 AI 智能命名
- **动作模板**：保存 / 加载动作配置，快速复用

## 依赖

- Eagle 4.0 Build20+
- [AI SDK](https://developer.eagle.cool/plugin-api/extra-module/ai-sdk) 插件

## 支持的 AI 模型

- OpenAI (GPT-5.2, GPT-5, o3 等)
- Anthropic Claude (Sonnet 4.6, Opus 4.6 等)
- Google Gemini (Gemini 3 Pro, Flash 等)
- DeepSeek (V3, R1)
- 通义千问 (Qwen3)
- Ollama（本地模型）
- LM Studio（本地模型）
- OpenAI Compatible（自定义端点）

## 开发

```bash
# 在 Eagle 中加载插件
1. 打开 Eagle → 插件面板
2. 点击"开发者选项" → "导入本地插件"
3. 选择本项目目录
```

## 许可证

MIT
