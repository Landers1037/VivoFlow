import { useEffect, useState } from "react";

const WIDE_QUERY = "(min-width: 768px)";

function matchesWideLayout() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(WIDE_QUERY).matches;
}

/** True when the window is wide enough for the desktop settings columns. */
export function useWideLayout() {
  const [matches, setMatches] = useState(matchesWideLayout);

  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY);
    const update = () => setMatches(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return matches;
}
