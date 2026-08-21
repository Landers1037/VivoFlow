import { Moon, Sun, Wifi, WifiOff } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Dashboard } from "@/components/Dashboard";
import { SettingsPanel } from "@/components/SettingsPanel";
import { FullPageLoader } from "@/components/amicro/loaders";
import { useVivoflowWs } from "@/hooks/useVivoflowWs";
import { cn } from "@/lib/utils";

export default function App() {
  const { conn, snapshot, history, config, error, setRemoteConfig } = useVivoflowWs();
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent/40 via-background to-background">
      <div className="safe-pad mx-auto max-w-5xl">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
              VivoFlow
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              {conn === "connected" ? (
                <Wifi className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-amber-500" />
              )}
              <span>
                {conn === "connected"
                  ? "已连接"
                  : conn === "connecting"
                    ? "连接中…"
                    : "已断开，重连中…"}
              </span>
              {config ? <span>· {config.interval_ms}ms</span> : null}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="切换主题"
              onClick={() => setTheme(dark ? "light" : "dark")}
            >
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <SettingsPanel config={config} onSave={setRemoteConfig} />
          </div>
        </header>

        {error ? (
          <div
            className={cn(
              "mb-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive",
            )}
          >
            {error}
          </div>
        ) : null}

        {!snapshot && conn !== "connected" ? (
          <FullPageLoader />
        ) : (
          <Dashboard snapshot={snapshot} history={history} />
        )}

        <footer className="mt-6 pb-2 text-center text-[11px] text-muted-foreground">
          JSON IPC · WebSocket · 移动优先仪表盘
        </footer>
      </div>
    </div>
  );
}
