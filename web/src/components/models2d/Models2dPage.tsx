import { useAppearance } from "@/hooks/useAppearance";

const IMAGE_BY_SCENE = {
  village: {
    portrait: "/models2d/village-portrait.png",
    landscape: "/models2d/village-landscape.png",
  },
  cyber_city: {
    portrait: "/models2d/cyber-city-portrait.png",
    landscape: "/models2d/cyber-city-landscape.png",
  },
  garden: {
    portrait: "/models2d/garden-portrait.png",
    landscape: "/models2d/garden-landscape.png",
  },
  rain_room: {
    portrait: "/models2d/rain-room-portrait.png",
    landscape: "/models2d/rain-room-landscape.png",
  },
} as const;

export function Models2dPage() {
  const { config, t } = useAppearance();
  const scene = config.model2d_id;
  const assets = IMAGE_BY_SCENE[scene];

  return (
    <main className="models2d-page" data-scene={scene} aria-label={t("models2dHomeLabel")}>
      <img className="models2d-scene-image models2d-scene-base models2d-scene-portrait" src={assets.portrait} alt="" />
      <img className="models2d-scene-image models2d-scene-base models2d-scene-landscape" src={assets.landscape} alt="" />
      <img className="models2d-scene-image models2d-scene-motion models2d-scene-portrait" src={assets.portrait} alt="" aria-hidden="true" />
      <img className="models2d-scene-image models2d-scene-motion models2d-scene-landscape" src={assets.landscape} alt="" aria-hidden="true" />
      {scene === "rain_room" ? (
        <img className="models2d-rain-layer" src="/models2d/rain-overlay.png" alt="" aria-hidden="true" />
      ) : null}
      <span className="sr-only">{t(`models2d${scene === "village" ? "Village" : scene === "cyber_city" ? "CyberCity" : scene === "garden" ? "Garden" : "RainRoom"}` as "models2dVillage" | "models2dCyberCity" | "models2dGarden" | "models2dRainRoom")}</span>
    </main>
  );
}
