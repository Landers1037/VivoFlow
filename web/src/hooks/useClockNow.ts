import { useEffect, useState } from "react";

export function useClockNow(showSeconds: boolean) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer = 0;

    const schedule = () => {
      const current = Date.now();
      const interval = showSeconds ? 1000 : 60_000;
      const delay = interval - (current % interval);
      timer = window.setTimeout(() => {
        setNow(new Date());
        schedule();
      }, Math.max(40, delay + 8));
    };

    const sync = () => {
      setNow(new Date());
      window.clearTimeout(timer);
      schedule();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") sync();
    };

    setNow(new Date());
    schedule();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", sync);
    window.addEventListener("pageshow", sync);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", sync);
      window.removeEventListener("pageshow", sync);
    };
  }, [showSeconds]);

  return now;
}
