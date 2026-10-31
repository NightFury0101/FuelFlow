import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import type { NutritionSource } from '../lib/types';

export function Sheet({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    document.body.classList.add('sheet-open');
    requestAnimationFrame(() => ref.current?.focus());
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      document.body.classList.remove('sheet-open');
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'sheet' + (wide ? ' sheet-wide' : '')} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        <div className="sheet-grip" aria-hidden="true" />
        <header className="sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={22} />
      </div>
      <p className="empty-title">{title}</p>
      {text && <p className="empty-text">{text}</p>}
      {action}
    </div>
  );
}

const SOURCE_LABEL: Record<NutritionSource, string> = {
  reference: 'Reference',
  openfoodfacts: 'Open Food Facts',
  custom: 'My food',
  recipe: 'Recipe',
  'ai-estimate': 'AI estimate',
  manual: 'Quick add',
};

const SOURCE_TITLE: Record<NutritionSource, string> = {
  reference: 'Typical values based on USDA data. Brands and recipes vary.',
  openfoodfacts: 'From product labels in the Open Food Facts community database.',
  custom: 'Values you entered.',
  recipe: 'Calculated from your ingredients.',
  'ai-estimate': 'Estimated from a photo and confirmed by you. Treat as approximate.',
  manual: 'Numbers you typed in.',
};

export function SourceTag({ source, ai }: { source: NutritionSource; ai?: boolean }) {
  const s = ai ? 'ai-estimate' : source;
  return (
    <span className={`tag tag-${s}`} title={SOURCE_TITLE[s]}>
      {SOURCE_LABEL[s]}
    </span>
  );
}

export function MacroPills({ p, c, f }: { p: number; c: number; f: number }) {
  return (
    <span className="macro-pills">
      <span className="mp mp-p">P {Math.round(p)}</span>
      <span className="mp mp-c">C {Math.round(c)}</span>
      <span className="mp mp-f">F {Math.round(f)}</span>
    </span>
  );
}

export function NumberInput({ value, onChange, onCommit, min = 0, max, step = 1, ariaLabel, suffix, id }: { value: string; onChange: (v: string) => void; onCommit?: () => void; min?: number; max?: number; step?: number; ariaLabel?: string; suffix?: string; id?: string }) {
  return (
    <div className="num-input">
      <input
        id={id}
        inputMode="decimal"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        // Scrolling the page over a focused number box would otherwise change the value.
        onWheel={(e) => (e.target as HTMLInputElement).blur()}
      />
      {suffix && <span className="num-suffix">{suffix}</span>}
    </div>
  );
}

export function Toast({ text, onUndo, onClose }: { text: string; onUndo?: () => void; onClose: () => void }) {
  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{text}</span>
      {onUndo && (
        <button
          className="toast-undo"
          onClick={() => {
            onUndo();
            onClose();
          }}
        >
          Undo
        </button>
      )}
    </div>
  );
}

export function Card({ children, className = '', title, action, icon }: { children: ReactNode; className?: string; title?: string; action?: ReactNode; icon?: IconName }) {
  return (
    <section className={'card ' + className}>
      {title && (
        <header className="card-head">
          <h2>
            {icon && <Icon name={icon} size={18} className="card-head-icon" />}
            {title}
          </h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function parseNum(s: string): number {
  const n = parseFloat(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}
