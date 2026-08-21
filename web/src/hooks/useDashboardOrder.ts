import { useCallback, useState } from "react";

export const DASHBOARD_SECTION_IDS = [
  "cpu",
  "memory",
  "temp",
  "gpu",
  "disk",
  "network",
] as const;

export type DashboardSectionId = (typeof DASHBOARD_SECTION_IDS)[number];

export const DEFAULT_WIDGETS: Record<DashboardSectionId, readonly string[]> = {
  cpu: ["gauge", "kpi", "load", "spark", "temp"],
  memory: ["gauge", "kpi", "info"],
  temp: ["cpuScatter", "memScatter"],
  gpu: ["gauge", "kpi", "info"],
  disk: ["treemap", "list"],
  network: ["area", "nics"],
};

export type DashboardLayout = {
  sections: DashboardSectionId[];
  widgets: Record<DashboardSectionId, string[]>;
};

const STORAGE_KEY = "vivoflow.dashboard.layout";
/** @deprecated migrated on read */
const LEGACY_SECTION_KEY = "vivoflow.dashboard.sectionOrder";

function isSectionId(value: unknown): value is DashboardSectionId {
  return (
    typeof value === "string" &&
    (DASHBOARD_SECTION_IDS as readonly string[]).includes(value)
  );
}

export function normalizeSectionOrder(raw: unknown): DashboardSectionId[] {
  const seen = new Set<DashboardSectionId>();
  const ordered: DashboardSectionId[] = [];

  if (Array.isArray(raw)) {
    for (const id of raw) {
      if (isSectionId(id) && !seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    }
  }

  for (const id of DASHBOARD_SECTION_IDS) {
    if (!seen.has(id)) ordered.push(id);
  }

  return ordered;
}

export function normalizeWidgetOrder(
  sectionId: DashboardSectionId,
  raw: unknown,
): string[] {
  const defaults = DEFAULT_WIDGETS[sectionId];
  const seen = new Set<string>();
  const ordered: string[] = [];

  if (Array.isArray(raw)) {
    for (const id of raw) {
      if (typeof id === "string" && defaults.includes(id) && !seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    }
  }

  for (const id of defaults) {
    if (!seen.has(id)) ordered.push(id);
  }

  return ordered;
}

function defaultLayout(): DashboardLayout {
  return {
    sections: [...DASHBOARD_SECTION_IDS],
    widgets: Object.fromEntries(
      DASHBOARD_SECTION_IDS.map((id) => [id, [...DEFAULT_WIDGETS[id]]]),
    ) as Record<DashboardSectionId, string[]>,
  };
}

function normalizeLayout(raw: unknown): DashboardLayout {
  const base = defaultLayout();
  if (!raw || typeof raw !== "object") return base;

  if (Array.isArray(raw)) {
    return { ...base, sections: normalizeSectionOrder(raw) };
  }

  const obj = raw as { sections?: unknown; widgets?: unknown };
  const sections = normalizeSectionOrder(obj.sections);
  const widgets = { ...base.widgets };

  if (obj.widgets && typeof obj.widgets === "object") {
    const map = obj.widgets as Record<string, unknown>;
    for (const id of DASHBOARD_SECTION_IDS) {
      widgets[id] = normalizeWidgetOrder(id, map[id]);
    }
  }

  return { sections, widgets };
}

function readStoredLayout(): DashboardLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeLayout(JSON.parse(raw));

    const legacy = localStorage.getItem(LEGACY_SECTION_KEY);
    if (legacy) {
      const layout = normalizeLayout(JSON.parse(legacy));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
      return layout;
    }
  } catch {
    /* ignore */
  }
  return defaultLayout();
}

function persistLayout(layout: DashboardLayout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* ignore quota / private mode */
  }
}

export function useDashboardOrder() {
  const [layout, setLayout] = useState<DashboardLayout>(readStoredLayout);

  const setSections = useCallback(
    (
      next:
        | DashboardSectionId[]
        | ((prev: DashboardSectionId[]) => DashboardSectionId[]),
    ) => {
      setLayout((prev) => {
        const sections = normalizeSectionOrder(
          typeof next === "function" ? next(prev.sections) : next,
        );
        const resolved = { ...prev, sections };
        persistLayout(resolved);
        return resolved;
      });
    },
    [],
  );

  const setWidgets = useCallback(
    (
      sectionId: DashboardSectionId,
      next: string[] | ((prev: string[]) => string[]),
    ) => {
      setLayout((prev) => {
        const widgets = {
          ...prev.widgets,
          [sectionId]: normalizeWidgetOrder(
            sectionId,
            typeof next === "function" ? next(prev.widgets[sectionId]) : next,
          ),
        };
        const resolved = { ...prev, widgets };
        persistLayout(resolved);
        return resolved;
      });
    },
    [],
  );

  return {
    sections: layout.sections,
    widgets: layout.widgets,
    setSections,
    setWidgets,
  };
}
