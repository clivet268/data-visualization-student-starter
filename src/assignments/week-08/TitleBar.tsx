import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import styles from './spillover.module.css';
import { CompareMode } from './CompareMode';
import { NPL_STATUS_LABELS, TIME_OPTIONS, type TimeKey } from './filters';

interface TitleBarProps {
  compareMode: boolean;
  setCompareMode: (value: boolean) => void;
  selectedCount: number;
  clearSelection: () => void;
  focusSelected: () => void;
  canFocus: boolean;
  pinsActive: boolean;
  setPinsActive: (value: boolean) => void;
  pinCount: number;
  clearPins: () => void;
  statusFilter: Set<string>;
  setStatusFilter: (s: Set<string>) => void;
  timeFilter: TimeKey;
  setTimeFilter: (t: TimeKey) => void;
}

// a titleButton that opens/closes a small menu, and closes on an outside click
function FilterMenu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  return (
    <div className={styles.statusFilter} ref={ref}>
      <button type="button" className={styles.titleButton} aria-expanded={open} onClick={() => setOpen(!open)}>
        {label} {open ? '▴' : '▾'}
      </button>
      {open && <div className={styles.dropdownMenu} role="menu">{children}</div>}
    </div>
  );
}

export function TitleBar({
  compareMode, setCompareMode, selectedCount, clearSelection, focusSelected, canFocus,
  pinsActive, setPinsActive, pinCount, clearPins, statusFilter, setStatusFilter, timeFilter, setTimeFilter,
}: TitleBarProps) {
  const controlsRef = useRef<HTMLDivElement>(null);

  // Compact when the last button would overflow. The class is toggled directly on the DOM node
  // before paint, so there is no flicker. It is measured in the full-size state every time.
  const fit = () => {
    const el = controlsRef.current;
    if (!el) return;
    el.classList.remove(styles.titleCompact);
    const last = el.lastElementChild as HTMLElement | null;
    if (last && last.getBoundingClientRect().right > el.getBoundingClientRect().right + 0.5) {
      el.classList.add(styles.titleCompact);
    }
  };
  const fitRef = useRef(fit);
  fitRef.current = fit;

  useLayoutEffect(fit); // re-measure after every render (labels change width)
  useEffect(() => {
    const el = controlsRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => fitRef.current());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toggleStatus = (code: string) => {
    const next = new Set(statusFilter);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setStatusFilter(next);
  };
  const timeLabel = TIME_OPTIONS.find((o) => o.key === timeFilter)?.label ?? '';

  return (
    <div className={`${styles.titleBar} ${styles.spilloverlay} ${styles.nicebox}`}>
      <div className={styles.title}>Spillover</div>
      <div className={styles.titleControls} ref={controlsRef}>
        <div className={styles.titleGroup}>
          <CompareMode compareMode={compareMode} setCompareMode={setCompareMode} />
          <button
            type="button"
            aria-pressed={pinsActive}
            disabled={!compareMode}
            onClick={() => setPinsActive(!pinsActive)}
            className={`${styles.groupButton} ${pinsActive ? styles.groupButtonActive : ''}`}
          >
            Pins{pinCount > 0 ? ` (${pinCount})` : ''}
          </button>
        </div>

        <div className={styles.titleGroup}>
          <button type="button" className={styles.groupButton} onClick={clearSelection} disabled={selectedCount === 0}>
            Clear selection{selectedCount > 0 ? ` (${selectedCount})` : ''}
          </button>
          <button type="button" className={styles.groupButton} onClick={clearPins} disabled={pinCount === 0}>
            Clear pins
          </button>
        </div>

        <button type="button" className={styles.titleButton} onClick={focusSelected} disabled={!canFocus}>
          Focus selected event(s)
        </button>

        <FilterMenu label={`Status (${statusFilter.size}/${Object.keys(NPL_STATUS_LABELS).length})`}>
          {Object.entries(NPL_STATUS_LABELS).map(([code, label]) => (
            <label key={code} className={styles.dropdownItem}>
              <input type="checkbox" checked={statusFilter.has(code)} onChange={() => toggleStatus(code)} />
              <span>{label}</span>
            </label>
          ))}
        </FilterMenu>

        <FilterMenu label={`Updated: ${timeLabel}`}>
          {TIME_OPTIONS.map((o) => (
            <label key={o.key} className={styles.dropdownItem}>
              <input type="radio" name="time-filter" checked={timeFilter === o.key} onChange={() => setTimeFilter(o.key)} />
              <span>{o.label}</span>
            </label>
          ))}
        </FilterMenu>
      </div>
    </div>
  );
}