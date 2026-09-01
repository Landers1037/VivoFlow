# 图片粒子系统

设置入口位于「媒体 → 粒子」。图片通过 `/api/particles` 系列接口保存在运行 VivoFlow 的主机，浏览器只读取原图并实时生成粒子缓冲，不保存派生文件。

`ParticleCanvas` 使用一个 Three.js `Points`、一个 `BufferGeometry` 和自定义 ShaderMaterial。2D 使用正交相机；3D 使用透视相机并提供景深浮雕、平面粒子板和立体粒子云。模式、粒径、景深、运动和音频响应均通过 uniform 更新，只有图片或密度变化才重新采样。

`particle.worker.ts` 使用 `createImageBitmap` 和 `OffscreenCanvas` 提取原图颜色、UV、亮度、边缘与稳定随机值。粒子上限为首页桌面 65,536、移动端 24,000、设置预览 12,000。预览限制 24 FPS 和 DPR 1；首页 DPR 上限 1.5。

开启音频响应后复用音频可视化的 64 段频谱、自动增益与输出设备配置。UV 横坐标映射频段，RMS 驱动整体呼吸，beat 触发 320 ms 扩散回聚。减少动态效果下关闭持续扰动、指针排斥和 beat 爆发。
