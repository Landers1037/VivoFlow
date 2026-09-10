import { useEffect, useMemo, useRef } from "react";
import type { AgentEmotionId, AgentShape } from "@/types";
import "@/vendor/grok-ball.js";

type GrokBallEngine = { setEmotion: (id: string) => boolean; setGaze: (x: number, y: number) => unknown; clearGaze: () => unknown; setActive: (active: boolean) => void; destroy: () => void };
declare global { interface Window { GrokBall: { create: (target: Element, options: Record<string, unknown>) => GrokBallEngine; config: { get: (id: string) => unknown; register: (config: unknown) => unknown } } } }

export const AGENT_EMOTIONS: { id: AgentEmotionId; zh: string; en: string; group: "life" | "emotion" | "agent" }[] = [
  { id:"00",zh:"睡眠",en:"Sleeping",group:"life"},{id:"01",zh:"唤醒",en:"Waking",group:"life"},{id:"02",zh:"待机",en:"Idle",group:"life"},{id:"03",zh:"好奇",en:"Curious",group:"life"},{id:"04",zh:"发呆",en:"Blank",group:"life"},{id:"05",zh:"加载苏醒",en:"Loading",group:"life"},{id:"06",zh:"休眠",en:"Resting",group:"life"},{id:"07",zh:"抖动唤醒",en:"Startled awake",group:"life"},
  {id:"10",zh:"开心",en:"Happy",group:"emotion"},{id:"11",zh:"疑惑",en:"Questioning",group:"emotion"},{id:"12",zh:"失落",en:"Sad",group:"emotion"},{id:"13",zh:"惊讶",en:"Surprised",group:"emotion"},{id:"14",zh:"害羞",en:"Shy",group:"emotion"},{id:"15",zh:"疲惫",en:"Tired",group:"emotion"},{id:"16",zh:"专注",en:"Focused",group:"emotion"},{id:"17",zh:"慌张",en:"Flustered",group:"emotion"},{id:"18",zh:"无奈",en:"Resigned",group:"emotion"},{id:"19",zh:"满意",en:"Satisfied",group:"emotion"},{id:"20",zh:"困惑",en:"Confused",group:"emotion"},{id:"21",zh:"生气",en:"Angry",group:"emotion"},
  {id:"30",zh:"思考中",en:"Thinking",group:"agent"},{id:"31",zh:"接收任务",en:"Receiving",group:"agent"},{id:"32",zh:"处理中",en:"Busy",group:"agent"},{id:"33",zh:"任务完成",en:"Done",group:"agent"},{id:"34",zh:"出错",en:"Error",group:"agent"},{id:"35",zh:"等待输入",en:"Waiting",group:"agent"},{id:"36",zh:"联网加载",en:"Connecting",group:"agent"},{id:"37",zh:"复述回忆",en:"Recalling",group:"agent"},{id:"38",zh:"拒绝受限",en:"Restricted",group:"agent"},{id:"39",zh:"输出回复",en:"Replying",group:"agent"},{id:"40",zh:"检索资料",en:"Searching",group:"agent"},{id:"41",zh:"停止终止",en:"Stopped",group:"agent"},
];

export function AgentFace({ shape, color, emotion, listening = false, animate = true, className = "" }: { shape: AgentShape; color: string; emotion: AgentEmotionId; listening?: boolean; animate?: boolean; className?: string }) {
  const mount = useRef<HTMLDivElement>(null);
  const engine = useRef<GrokBallEngine | null>(null);
  const eyeColor = useMemo(() => {
    const n = Number.parseInt(color.slice(1), 16);
    const luminance = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
    return luminance > 145 ? "#171817" : "#f5f3ed";
  }, [color]);
  useEffect(() => {
    const node = mount.current;
    if (!node) return;
    if (!window.GrokBall.config.get("listening")) window.GrokBall.config.register({ id:"listening", name:"聆听", group:"agent", transition:200, pool:[3,21], poolMs:[1600,2600], blinkMs:[1800,3400], body:{scale:1.03,breathe:.018}, eyes:{both:{scaleX:1.18,scaleY:1.18,y:-4}}, anims:[{target:"eyes",prop:"lookX",type:"sine",amp:3,period:900}] });
    engine.current = window.GrokBall.create(node, { emotion:listening ? "listening" : emotion, color, eyeColor, shape, idle:false, autostart:animate, lite:!animate });
    const move = (event: PointerEvent) => {
      const r = node.getBoundingClientRect();
      engine.current?.setGaze(Math.max(-1,Math.min(1,(event.clientX-r.left-r.width/2)/(r.width/2))), Math.max(-1,Math.min(1,(event.clientY-r.top-r.height/2)/(r.height/2))));
    };
    if (animate) window.addEventListener("pointermove", move);
    return () => { window.removeEventListener("pointermove", move); engine.current?.destroy(); engine.current=null; };
  }, [animate, color, emotion, eyeColor, listening, shape]);
  return <div ref={mount} className={`agent-face ${animate ? "is-animated" : ""} ${listening ? "is-listening" : ""} ${className}`} data-emotion={emotion} aria-label={listening ? "Listening" : emotion} />;
}
