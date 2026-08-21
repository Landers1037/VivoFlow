import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AppConfig } from "@/types";
import { Settings2 } from "lucide-react";

export function SettingsPanel({
  config,
  onSave,
}: {
  config: AppConfig | null;
  onSave: (cfg: AppConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const draft = useMemo<AppConfig>(
    () =>
      config ?? {
        interval_ms: 1000,
        history_points: 60,
        enabled: { cpu: true, memory: true, gpu: true, disk: true, network: true },
      },
    [config],
  );
  const [local, setLocal] = useState<AppConfig>(draft);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setLocal(config ?? draft);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="采集设置">
          <Settings2 className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>采集参数</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="interval">采集间隔（ms）: {local.interval_ms}</Label>
            <input
              id="interval"
              type="range"
              min={200}
              max={5000}
              step={100}
              value={local.interval_ms}
              onChange={(e) =>
                setLocal((s) => ({ ...s, interval_ms: Number(e.target.value) }))
              }
              className="w-full accent-primary"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="history">历史点数: {local.history_points}</Label>
            <input
              id="history"
              type="range"
              min={10}
              max={180}
              step={5}
              value={local.history_points}
              onChange={(e) =>
                setLocal((s) => ({ ...s, history_points: Number(e.target.value) }))
              }
              className="w-full accent-primary"
            />
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium">模块开关</p>
            {(
              [
                ["cpu", "CPU"],
                ["memory", "内存"],
                ["gpu", "显卡"],
                ["disk", "磁盘"],
                ["network", "网络"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={key}>{label}</Label>
                <Switch
                  id={key}
                  checked={local.enabled[key]}
                  onCheckedChange={(checked) =>
                    setLocal((s) => ({
                      ...s,
                      enabled: { ...s.enabled, [key]: checked },
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <Button
            className="w-full"
            onClick={() => {
              onSave(local);
              setOpen(false);
            }}
          >
            应用到后端
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
