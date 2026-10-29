import { useState, useRef, useLayoutEffect, type ReactNode } from 'react';
import styles from './spillover.module.css';

interface SlidePanelProps {
  side: 'left' | 'right';
  placement: string; // class that positions and styles the panel (styles.newsFeed etc.)
  children: ReactNode;
}

const TOGGLE_W = 26;
const TOGGLE_INSET_TOP = 8;

export function SlidePanel({ side, placement, children }: SlidePanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: TOGGLE_INSET_TOP });
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // the arrow lives outside the panel (the panel clips its children), so measure where it goes
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const panel = panelRef.current;
    if (!wrap || !panel) return;
    const measure = () => {
      const edgeLeft = panel.offsetLeft; // ignores the slide transform
      const top = panel.offsetTop + TOGGLE_INSET_TOP;
      let left: number;
      if (side === 'left') left = collapsed ? 0 : edgeLeft + panel.offsetWidth;
      else left = collapsed ? wrap.clientWidth - TOGGLE_W : edgeLeft - TOGGLE_W;
      setPos({ left, top });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    ro.observe(panel);
    return () => ro.disconnect();
  }, [side, collapsed]);

  // arrow points at the edge the panel slides toward, and flips when collapsed
  const pointsLeft = (side === 'left') !== collapsed;

  return (
    <div
      ref={wrapRef}
      className={[
        styles.slideWrap,
        side === 'left' ? styles.slideLeft : styles.slideRight,
        collapsed ? styles.slideCollapsed : '',
      ].join(' ')}
    >
      <div ref={panelRef} className={`${styles.panel} ${placement} ${styles.spilloverlay} ${styles.nicebox}`}>
        {children}
      </div>
      <button
        type="button"
        className={styles.slideToggle}
        style={{ left: pos.left, top: pos.top }}
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
        aria-expanded={!collapsed}
      >
        {pointsLeft ? '◀' : '▶'}
      </button>
    </div>
  );
}