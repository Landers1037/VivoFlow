import { useState } from "react";
import { Settings2, Wifi, WifiOff } from "lucide-react";
import { ThemeProvider } from "next-themes";
import { Button } from "@/components/ui/button";
import { Dashboard } from "@/components/Dashboard";
import { SettingsPage } from "@/components/SettingsPage";
import { FullPageLoader } from "@/components/viz";
import { AppearanceProvider, useAppearance } from "@/hooks/useAppearance";
import { useVivoflowWs } from "@/hooks/useVivoflowWs";
import { cn } from "@/lib/utils";

export default function App() {
  const ws = useVivoflowWs();

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AppearanceProvider config={ws.config} onPersist={ws.setRemoteConfig}>
        <AppShell {...ws} />
      </AppearanceProvider>
    </ThemeProvider>
  );
}

function AppShell({
  conn,
  snapshot,
  history,
  config,
  error,
  setRemoteConfig,
}: ReturnType<typeof useVivoflowWs>) {
  const { t } = useAppearance();
  const [page, setPage] = useState<"dashboard" | "settings">("dashboard");

  return (
    <div className="vf-shell">
      <div className="safe-pad mx-auto max-w-5xl">
        {page === "settings" ? (
          <SettingsPage
            config={config}
            onSave={setRemoteConfig}
            onBack={() => setPage("dashboard")}
          />
        ) : (
          <>
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
                      ? t("connected")
                      : conn === "connecting"
                        ? t("connecting")
                        : t("disconnected")}
                  </span>
                  {config ? <span>· {config.interval_ms}ms</span> : null}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                aria-label={t("settings")}
                onClick={() => setPage("settings")}
              >
                <Settings2 className="h-5 w-5" />
              </Button>
            </header>

            {error ? (
              <div
                className={cn(
                  "mb-3 border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive",
                )}
                style={{ borderRadius: "var(--radius)" }}
              >
                {error.kind === "key" ? t(error.key) : error.message}
              </div>
            ) : null}

            {!snapshot && conn !== "connected" ? (
              <FullPageLoader label={t("connectingService")} />
            ) : (
              <Dashboard snapshot={snapshot} history={history} />
            )}

            <footer className="mt-6 pb-2 text-center text-[11px] text-muted-foreground">
              {t("footer")}
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
