# VivoFlow 智能体环境管理 UI QA

## 对照目标

- 参考图：`C:/Users/opsad/AppData/Local/Temp/codex-clipboard-d2e6b335-6b20-4f2a-9a3f-f4422b71cdfa.png`（1078 × 498）。
- 实现页面：设置 → 智能体 → 语音服务状态。
- 浏览器检查：Codex 内置浏览器，桌面视口 1100 × 700、移动视口 390 × 844。
- 状态：Node 已安装；Ollama、Whisper、ChatTTS 未就绪；Whisper 三个模型均未安装。

## 对照结论

- 环境导航：参考图中的 Node、Ollama、Whisper、ChatTTS 标签已实现为可操作 Tab，每项保留独立状态点，当前 Tab 使用描边和底色强调。
- 环境操作：原先混排的全局按钮已拆入对应面板。Node 提供检查、重启和安装入口；Ollama 提供地址、模型、连接测试、刷新和安装入口；ChatTTS 分开管理 Python 环境、模型和试听。
- Whisper 模型：`base`、`small`、`medium` 分为三行，显示体积、安装状态、当前选择和独立操作。实测三个模型均未安装时，三行分别显示“下载”按钮。
- 进度与取消：下载中显示实时百分比；无 Content-Length 时显示“下载中…”，同一行提供停止按钮。不同 Whisper 模型使用独立任务名，不会共享错误状态。
- 响应式：移动视口下四个 Tab 保持一行，模型状态与操作允许换行；文档宽度检测为 `scrollWidth = clientWidth = 390`，没有横向溢出。
- 可访问性：Tab 使用 `tablist`、`tab`、`tabpanel`、`aria-selected` 和 `aria-controls`；下载图标按钮有文本或可访问名称。
- 控制台：切换四个 Tab 后未发现 error 或 warning。

## 验证

- [x] 四个环境 Tab 均可切换，并呈现各自内容。
- [x] Whisper 三个未安装模型均显示独立下载按钮。
- [x] Node 版本从运行服务返回并显示。
- [x] 前端构建与测试通过。
- [x] Node 服务语法检查与测试通过。
- [x] Rust 测试通过。
- [x] 桌面与移动视口视觉检查通过。

未发现需要修复的 P0、P1 或 P2 问题。

final result: passed
