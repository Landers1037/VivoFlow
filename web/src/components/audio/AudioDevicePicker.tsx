import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, MonitorSpeaker } from "lucide-react";
import { useAppearance } from "@/hooks/useAppearance";
import { cn } from "@/lib/utils";
import type { AudioDevice } from "@/types";

export function useAudioDevices() {
  const { t } = useAppearance();
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/audio/devices");
      if (!response.ok) throw new Error(`${response.status}`);
      const body = await response.json() as { devices?: AudioDevice[] };
      setDevices(body.devices ?? []);
    } catch { setError(t("audioDeviceLoadFailed")); }
    finally { setLoading(false); }
  }, [t]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { devices, loading, error, refresh };
}

export function AudioDevicePicker({ devices, value, disabled, onChange }: { devices: AudioDevice[]; value: string | null; disabled: boolean; onChange: (value: string | null) => void }) {
  const { t } = useAppearance();
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const options = [{ id: "", name: t("systemDefaultDevice"), is_default: false }, ...devices];
  const selectedIndex = Math.max(0, options.findIndex((option) => option.id === (value ?? "")));
  const selected = options[selectedIndex];
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.id || null); setHighlighted(index); setOpen(false);
  };
  return <div ref={rootRef} className="relative">
    <button id="audio-device" type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open}
      onClick={() => { setHighlighted(selectedIndex); setOpen((current) => !current); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { setOpen(false); return; }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (!open) { setOpen(true); setHighlighted(selectedIndex); return; }
          const delta = event.key === "ArrowDown" ? 1 : -1;
          setHighlighted((current) => (current + delta + options.length) % options.length);
        } else if (event.key === "Enter" && open) { event.preventDefault(); choose(highlighted); }
      }}
      className={cn("vf-row flex min-h-14 w-full items-center gap-3 border px-3 py-2 text-left outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50", open ? "border-primary/55 bg-primary/[0.055] shadow-[0_12px_32px_color-mix(in_oklch,var(--primary)_10%,transparent)]" : "border-border bg-card hover:border-primary/35 hover:bg-muted/35")}
      style={{ borderRadius: "var(--radius)" }}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary"><MonitorSpeaker className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{selected.name}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{selected.id ? t("audioSpecificDevice") : t("audioDefaultDeviceHint")}</span></span>
      <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180 text-primary")} />
    </button>
    {open ? <div role="listbox" aria-label={t("audioOutputDevice")} className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden border border-border/80 bg-card/95 p-1.5 shadow-[0_20px_55px_oklch(0_0_0/22%)] backdrop-blur-xl" style={{ borderRadius: "var(--radius)" }}>
      {options.map((option, index) => {
        const active = option.id === (value ?? "");
        return <button key={option.id || "system-default"} type="button" role="option" aria-selected={active} onPointerMove={() => setHighlighted(index)} onClick={() => choose(index)} className={cn("flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left outline-none transition-colors", highlighted === index ? "bg-primary/10" : "hover:bg-muted/60", active && "text-primary")} style={{ borderRadius: "calc(var(--radius) * .72)" }}>
          <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border", active ? "border-primary/30 bg-primary/15" : "border-border bg-muted/45")}><MonitorSpeaker className="h-3.5 w-3.5" /></span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{option.name}</span>
          {option.is_default ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{t("defaultDevice")}</span> : null}
          <span className="flex h-5 w-5 items-center justify-center">{active ? <Check className="h-4 w-4" /> : null}</span>
        </button>;
      })}
    </div> : null}
  </div>;
}
