import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function SettingsGroup({
  label,
  footer,
  children,
}: {
  label?: string;
  footer?: string;
  children: ReactNode;
}) {
  return (
    <section className="settings-group">
      {label ? <h2 className="settings-group-label">{label}</h2> : null}
      <div className="settings-group-body">{children}</div>
      {footer ? <p className="settings-group-footer">{footer}</p> : null}
    </section>
  );
}

export function SettingsRow({
  icon: Icon,
  title,
  subtitle,
  value,
  chevron = false,
  onClick,
  disabled,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  value?: string;
  chevron?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      className={cn("settings-row", disabled && "is-disabled")}
      type={onClick ? "button" : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
    >
      {Icon ? (
        <span className="settings-row-icon" aria-hidden="true">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
      ) : null}
      <span className="settings-row-copy">
        <span className="settings-row-title">{title}</span>
        {subtitle ? <span className="settings-row-subtitle">{subtitle}</span> : null}
      </span>
      {value ? <span className="settings-row-value">{value}</span> : null}
      {children}
      {chevron ? <ChevronRight className="settings-row-chevron" aria-hidden="true" /> : null}
    </Comp>
  );
}

export function SettingsSwitchRow({
  id,
  icon,
  title,
  subtitle,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className={cn("settings-row", disabled && "is-disabled")}>
      {icon ? (
        <span className="settings-row-icon" aria-hidden="true">
          {(() => {
            const Icon = icon;
            return <Icon className="h-4 w-4" strokeWidth={1.75} />;
          })()}
        </span>
      ) : null}
      <label htmlFor={id} className="settings-row-copy">
        <span className="settings-row-title">{title}</span>
        {subtitle ? <span className="settings-row-subtitle">{subtitle}</span> : null}
      </label>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function SettingsSliderRow({
  id,
  title,
  valueLabel,
  min,
  max,
  step,
  value,
  disabled,
  onChange,
}: {
  id: string;
  title: string;
  valueLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className={cn("settings-row settings-row-stack", disabled && "is-disabled")}>
      <div className="settings-slider-meta">
        <label htmlFor={id} className="settings-row-title">{title}</label>
        <span className="settings-row-value">{valueLabel}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="settings-slider"
      />
    </div>
  );
}

export function SettingsSegmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="settings-segmented" role="radiogroup">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          disabled={disabled}
          className={cn("settings-segmented-item", value === option.id && "is-active")}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
