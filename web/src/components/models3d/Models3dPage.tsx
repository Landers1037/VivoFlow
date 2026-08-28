import { Models3dRenderer } from "@/components/models3d/Models3dRenderer";
import { useAppearance } from "@/hooks/useAppearance";

export function Models3dPage() {
  const { config } = useAppearance();
  return (
    <main className="models3d-page">
      <Models3dRenderer modelId={config.model3d_id} interactive className="models3d-stage" />
    </main>
  );
}
