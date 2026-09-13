import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { LiquidGlassClock } from "../src/components/clock/LiquidGlassClock";
import type { ClockGlassBackground, ClockFont } from "../src/types";
import "../src/index.css";
import { checkGlassRendering } from "./glass-rendering";
const backgrounds = ["liquid_ether", "aurora", "plasma", "beams", "ghost_fibers", "gradient_waves", "lightfall", "dither", "galaxy", "none"] as ClockGlassBackground[];
function Verify() {
  const [result, setResult] = useState("");
  const [background, setBackground] = useState<ClockGlassBackground>("liquid_ether");
  const [font, setFont] = useState<ClockFont>("default");
  const [time, setTime] = useState("20:02:55");
  const [seconds, setSeconds] = useState(true);
  const [meta, setMeta] = useState(true);
  const [portrait, setPortrait] = useState(false);
  return <><div style={{position:"fixed",zIndex:10,top:0,left:0,background:"#141a24",color:"white",display:"flex",gap:12}}>
    <select aria-label="Background" value={background} onChange={e=>setBackground(e.target.value as ClockGlassBackground)}>{backgrounds.map(value=><option key={value}>{value}</option>)}</select>
    <select aria-label="Font" value={font} onChange={e=>setFont(e.target.value as ClockFont)}>{["default","outfit","jua","monomaniac_one","bungee_shade"].map(value=><option key={value}>{value}</option>)}</select>
    <select aria-label="Time" value={time} onChange={e=>setTime(e.target.value)}>{["20:02:55","00:00:00","08:08:08","23:59:59","23:59:00"].map(value=><option key={value}>{value}</option>)}</select>
    <button onClick={()=>setSeconds(!seconds)}>Seconds {String(seconds)}</button><button onClick={()=>setMeta(!meta)}>Date {String(meta)}</button><button onClick={()=>setPortrait(!portrait)}>Portrait {String(portrait)}</button><button onClick={()=>void checkGlassRendering().then(value=>setResult(JSON.stringify(value)))}>Check pixels</button>
    <output style={{position:"fixed",bottom:0,left:0,fontSize:12}}>{result}</output>
  </div><div style={{width:portrait?375:"100%",margin:"auto"}}><LiquidGlassClock now={new Date(`2026-09-12T${time}+08:00`)} lang="zh" week={meta} date={meta} seconds={seconds} timezoneOffsetMinutes={480} font={font} background={background}/></div></>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><Verify/></StrictMode>);
