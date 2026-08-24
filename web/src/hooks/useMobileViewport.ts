import { useEffect, useState } from "react";

const MOBILE_SHORT_EDGE_MAX = 640;

function matchesHandheldViewport() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches &&
    Math.min(window.innerWidth, window.innerHeight) <= MOBILE_SHORT_EDGE_MAX
  );
}

/** True for touch-first phone-sized viewports in either orientation. */
export function useHandheldViewport() {
  const [matches, setMatches] = useState(matchesHandheldViewport);

  useEffect(() => {
    const update = () => setMatches(matchesHandheldViewport());
    const pointerQuery = window.matchMedia("(pointer: coarse)");

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    pointerQuery.addEventListener?.("change", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      pointerQuery.removeEventListener?.("change", update);
    };
  }, []);

  return matches;
}
