import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Amicro-inspired iOS spinner loader */
export function IosSpinner({ className, size = 36 }: { className?: string; size?: number }) {
  const bars = 12;
  return (
    <div
      className={cn("relative", className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: bars }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute left-1/2 top-0 origin-bottom rounded-full bg-foreground/80"
          style={{
            width: size * 0.08,
            height: size * 0.28,
            marginLeft: -size * 0.04,
            transform: `rotate(${(360 / bars) * i}deg) translateY(0)`,
            transformOrigin: `center ${size / 2}px`,
          }}
          animate={{ opacity: [0.15, 1, 0.15] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: (i / bars) * 1,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}

/** Amicro-inspired pulse dots */
export function PulseDots({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)} role="status" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2.5 w-2.5 rounded-full bg-foreground/70"
          animate={{ scale: [0.7, 1.15, 0.7], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

/** Amicro-inspired skeleton block */
export function SkeletonLoader({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {[1, 0.75, 0.9].map((w, i) => (
        <motion.div
          key={i}
          className="h-3 rounded-full bg-muted"
          style={{ width: `${w * 100}%` }}
          animate={{ opacity: [0.45, 0.9, 0.45] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.12 }}
        />
      ))}
    </div>
  );
}

export function FullPageLoader({ label = "连接采集服务…" }: { label?: string }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4">
      <IosSpinner size={42} />
      <p className="text-sm text-muted-foreground">{label}</p>
      <PulseDots />
    </div>
  );
}
