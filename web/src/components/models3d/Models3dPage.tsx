import { Models3dClock } from "@/components/models3d/Models3dClock";
import { Models3dRenderer } from "@/components/models3d/Models3dRenderer";
import { useAppearance } from "@/hooks/useAppearance";

export function Models3dPage() {
  const { config } = useAppearance();
  return (
    <main className="models3d-page">
      <Models3dRenderer modelId={config.model3d_id} interactive className="models3d-stage" />
      {config.model3d_clock_enabled ? (
        <Models3dClock
          modelId={config.model3d_id}
          position={config.model3d_clock_position}
          showDate={config.model3d_clock_show_date}
          showSeconds={config.model3d_clock_show_seconds}
        />
      ) : null}
    </main>
  );
}
