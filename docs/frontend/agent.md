# agent — 动态智能体

设置 → 显示 → 智能体用于配置首页全屏表情球。它与其他首页全屏模块互斥，优先级最低。

前端调用固定在 `de368ce3acdc5a70e871ee46ebbe8f60b11d3d6a` 的 MIT 许可 grok-ball 引擎，支持 `blob`、`wedge`、`gem` 三种形状、32 种内置表情和应用注册的 `listening` 表情。默认是米白色 `#f3f0ea`、待机表情 `02`；眼睛颜色按身体亮度自动取深色或浅色。

随机表情开启后每 8–15 秒切换一次。聆听状态始终优先；声音结束后恢复默认表情并重新开始随机计时。

智能体语音只在智能体首页可见时请求当前浏览器的麦克风。浏览器通过 AudioWorklet 将单声道音频重采样为 16 kHz PCM16，每 40 ms 发送到 `/ws/agent-voice`。离开首页、隐藏页面、关闭功能或断线会释放 MediaStream、AudioContext 和 WebSocket。

`getUserMedia` 需要安全上下文。localhost 可以直接使用；生产后端默认通过 HTTPS 提供页面。局域网设备需要先安装并信任 VivoFlow 自动创建的根 CA，普通 HTTP 页面或尚未受信任的证书不满足麦克风访问条件。
