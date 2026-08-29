import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useAppearance } from "@/hooks/useAppearance";
import { cn } from "@/lib/utils";
import type { Model3dId } from "@/types";

const Models3dCanvas = lazy(() => import("@/components/models3d/Models3dCanvas"));

export function Models3dRenderer({
  modelId,
  preview = false,
  interactive = false,
  className,
}: {
  modelId: Model3dId;
  preview?: boolean;
  interactive?: boolean;
  className?: string;
}) {
  const { t, config } = useAppearance();
  const [unsupported, setUnsupported] = useState(false);
  const orbitStyle = config.model3d_orbit_style;
  const texturesEnabled = config.model3d_textures_enabled;
  const treeCanopyShape = config.model3d_tree_canopy_shape;
  const treeCanopyColor = config.model3d_tree_canopy_color;
  const treeBaseShape = config.model3d_tree_base_shape;
  const treeBaseColor = config.model3d_tree_base_color;
  const treeTrunkColor = config.model3d_tree_trunk_color;
  const flowerType = config.model3d_flower_type;
  const flowerPetalColor = config.model3d_flower_petal_color;
  const flowerFoliageColor = config.model3d_flower_foliage_color;
  const flowerPotShape = config.model3d_flower_pot_shape;
  const flowerPotColor = config.model3d_flower_pot_color;
  const flowerSeed = config.model3d_flower_seed;
  const flowerGeneratorVersion = config.model3d_flower_generator_version;
  const townSeed = config.model3d_town_seed;
  const townGeneratorVersion = config.model3d_town_generator_version;
  const townPopulation = config.model3d_town_population;
  const townDensity = config.model3d_town_density;
  const townTime = config.model3d_town_time;
  const treeVariation = useMemo(
    () => (Math.random() * 0xffffffff) >>> 0,
    [modelId, treeCanopyShape],
  );

  useEffect(() => {
    setUnsupported(false);
  }, [
    modelId,
    orbitStyle,
    texturesEnabled,
    treeCanopyShape,
    treeCanopyColor,
    treeBaseShape,
    treeBaseColor,
    treeTrunkColor,
    townSeed,
    townGeneratorVersion,
    townPopulation,
    townDensity,
    townTime,
    treeVariation,
    flowerType,
    flowerPetalColor,
    flowerFoliageColor,
    flowerPotShape,
    flowerPotColor,
    flowerSeed,
    flowerGeneratorVersion,
  ]);

  if (unsupported) {
    return (
      <div className={cn("models3d-fallback", className)}>
        <p>{t("models3dUnsupported")}</p>
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      <Suspense fallback={<div className="models3d-fallback">{t("models3dLoading")}</div>}>
        <Models3dCanvas
          modelId={modelId}
          orbitStyle={orbitStyle}
          texturesEnabled={texturesEnabled}
          treeCanopyShape={treeCanopyShape}
          treeCanopyColor={treeCanopyColor}
          treeBaseShape={treeBaseShape}
          treeBaseColor={treeBaseColor}
          treeTrunkColor={treeTrunkColor}
          treeVariation={treeVariation}
          flowerType={flowerType}
          flowerPetalColor={flowerPetalColor}
          flowerFoliageColor={flowerFoliageColor}
          flowerPotShape={flowerPotShape}
          flowerPotColor={flowerPotColor}
          flowerSeed={flowerSeed}
          flowerGeneratorVersion={flowerGeneratorVersion}
          townSeed={townSeed}
          townGeneratorVersion={townGeneratorVersion}
          townPopulation={townPopulation}
          townDensity={townDensity}
          townTime={townTime}
          preview={preview}
          interactive={interactive}
          className="h-full w-full"
          onUnavailable={() => setUnsupported(true)}
        />
      </Suspense>
    </div>
  );
}
