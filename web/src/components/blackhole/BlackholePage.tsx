import { BlackholeCanvas } from "@/components/blackhole/BlackholeCanvas";
import { useAppearance } from "@/hooks/useAppearance";

export function BlackholePage() {
  const { t } = useAppearance();
  return (
    <main className="blackhole-page">
      <BlackholeCanvas unsupportedLabel={t("blackholeWebgpuUnsupported")} />
    </main>
  );
}
