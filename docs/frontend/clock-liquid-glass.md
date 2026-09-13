# 液态玻璃时钟来源

液态玻璃时钟将 React Bits Glass Surface 的 SVG 滤镜流程移植为 WebGL 数字合成器，并直接使用通过 React Bits shadcn 注册表安装的背景组件。安装命令记录如下：

```text
npx shadcn@latest add @react-bits/LiquidEther-TS-TW
npx shadcn@latest add @react-bits/Aurora-TS-TW
npx shadcn@latest add @react-bits/Plasma-TS-TW
npx shadcn@latest add @react-bits/Beams-TS-TW
npx shadcn@latest add @react-bits/GhostFibers-TS-TW
npx shadcn@latest add @react-bits/GradientWaves-TS-TW
npx shadcn@latest add @react-bits/Lightfall-TS-TW
npx shadcn@latest add @react-bits/Dither-TS-TW
npx shadcn@latest add @react-bits/Galaxy-TS-TW
```

来源页面：

- https://www.reactbits.dev/components/glass-surface
- https://www.reactbits.dev/backgrounds/liquid-ether
- https://www.reactbits.dev/backgrounds/aurora
- https://www.reactbits.dev/backgrounds/plasma
- https://www.reactbits.dev/backgrounds/beams
- https://www.reactbits.dev/backgrounds/ghost-fibers
- https://www.reactbits.dev/backgrounds/gradient-waves
- https://www.reactbits.dev/backgrounds/lightfall
- https://www.reactbits.dev/backgrounds/dither
- https://www.reactbits.dev/backgrounds/galaxy
- Glass Surface 源码：https://raw.githubusercontent.com/DavidHDev/react-bits/main/src/ts-default/Components/GlassSurface/GlassSurface.tsx

注册表生成的组件保存在 `web/src/components/clock/backgrounds/`，由 `ClockBackgroundRenderer.tsx` 统一挂载。各组件只增加最终屏幕渲染完成通知，保留上游背景算法。合成器在该回调返回前立即上传背景画布，避免 WebGL 默认绘图缓冲区被清空；数字内外使用同一张纹理。合成器没有独立动画循环，秒数、字体和日期变化只重绘保留的背景纹理，背景组件由 memo 保持挂载。所有背景关闭了鼠标接管；Liquid Ether 使用官方自动演示驱动持续播放。

组件需要 `ogl`、`three`、`@react-three/fiber`、`@react-three/drei`、`@react-three/postprocessing` 和 `postprocessing`，版本范围记录在 `web/package.json` 与 `web/package-lock.json`。玻璃合成与纹理上传在移动端限制为 30 FPS、DPR 1.5，桌面限制为 60 FPS、DPR 2；背景组件保留各自的调度方式。页面进入后台时合成器停止上传，恢复时同步重绘。减少动态效果时合成器保留首帧背景，但上游部分组件仍会调度静态帧。

React Bits 使用 MIT + Commons Clause 许可。本项目保留来源、版权与许可说明，仅纳入组件源码和时钟适配层；上游许可全文见 https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md。液态玻璃在 `clock_font=default` 时使用本地 `web/src/fonts/Jua-Regular.ttf`，也可通过统一时钟字体设置切换为 Outfit、Monomaniac One 或 Bungee Shade。

## Glass Surface 移植范围

- 参考源为用户于 2026-09-12 提供的完整 GlassSurface.tsx，原样保存在 `web/src/components/clock/glass/references/GlassSurface.tsx.txt`；许可全文保存在同目录 `LICENSE.md`。该附件没有上游 commit 标识，未将它标注为特定上游提交。
- 对应 upstream 的 `feDisplacementMap → feColorMatrix → feBlend(screen) → feGaussianBlur`：使用 `P' = P + scale × (map - 0.5)` 分别采样 R/G/B；采用示例 distortionScale=-150、通道偏移 5/15/25。最终使用轻量五点模糊，宽度 0.65 CSS px，避免小字号被示例 displace=15 的强模糊抹掉。
- 原组件的矩形红/蓝梯度改为字体笔画的距离场和法线；平滑位移场以避免锯齿放大为玻璃条纹。像素遮罩保留内部孔洞及字体轮廓，移除旧版蓝色填充、全字平移和多层彩色描边。
- 数字遮罩按字体及字符缓存在 GPU，字号与时间变化复用纹理。背景切换和卸载释放纹理、程序、缓冲区及合成器 WebGL 上下文；StrictMode 重新挂载使用新画布。
- 没有直接用矩形 `<GlassSurface>` 包住数字：原组件的 Safari/Firefox 磨砂降级无法满足手机动态折射。此处仅移植其滤镜流程和轮廓适配，并非全部 props 的等价实现。

## 浏览器回归验证

启动 Vite 后打开 `/tests/clock-glass.html`，点击 **Check pixels**。`web/tests/glass-rendering.ts` 在真实 WebGL 上检查条纹背景采样、孔洞/外部不变、时间变化保留纹理、下一帧同步更新及 GL 错误；不能用 jsdom 的 canvas mock 代替。此测试页面不纳入生产入口。

2026-09-12：本地 Chromium 预览验证真实纹理折射，并检查横竖屏、字体与显示开关。真实 iPhone Safari 尚未验证，桌面中的手机尺寸预览不等于 Safari 测试。
