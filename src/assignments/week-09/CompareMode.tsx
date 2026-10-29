import styles from './spillover.module.css';

interface CheckboxInputProps {
  compareMode: boolean;
  setCompareMode: (value: boolean) => void;
}
export function CompareMode({ compareMode, setCompareMode }: CheckboxInputProps) {
  return (
    <button
      type="button"
      aria-pressed={compareMode}
      onClick={() => setCompareMode(!compareMode)}
      className={`${styles.titleButton} ${compareMode ? styles.titleButtonActive : ''}`}
    >
      Compare mode: {compareMode ? 'On' : 'Off'}
    </button>
  );
}
