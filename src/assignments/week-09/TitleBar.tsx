import { useEffect, useState, useRef } from 'react';
import styles from './spillover.module.css';
import { CompareMode } from './CompareMode';

interface CheckboxInputProps {
  compareMode: boolean;
  setCompareMode: (value: boolean) => void;
  selectedCount: number;
  clearSelection: () => void;
}

export function TitleBar({
  compareMode,
  setCompareMode,
  selectedCount,
  clearSelection,
}: CheckboxInputProps) {
  const [showFilterList, setFilterListShow] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const techOptions = [
    { id: 'react', label: 'React' },
    { id: 'typescript', label: 'TypeScript' },
    { id: 'nextjs', label: 'Next.js' },
    { id: 'tailwindcss', label: 'Tailwind CSS' },
    { id: 'nodejs', label: 'Node.js' },
  ];

  const handleCheckboxChange = (id: string) => {
    setSelectedIds((prevSelected) => {
      const updated = prevSelected.includes(id)
        ? prevSelected.filter((item) => item !== id)
        : [...prevSelected, id];

      //onChange(updated);
      return updated;
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        //setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  return (
    <div className={`${styles.titleBar} ${styles.spilloverlay} ${styles.nicebox}`}>
      <div className={styles.title}>Spillover</div>
      <div className={styles.titleControls}>
        <CompareMode compareMode={compareMode} setCompareMode={setCompareMode} />
        <button
          type="button"
          className={styles.titleButton}
          onClick={clearSelection}
          disabled={selectedCount === 0}
        >
          Clear selection{selectedCount > 0 ? ` (${selectedCount})` : ''}
        </button>
        <label className={styles.titleButton}>
          Focus selected event
          <input type="checkbox" />
        </label>
        <div className={styles.statusFilter} ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setFilterListShow(!showFilterList)}
            className={styles.titleButton}
          >
            Filter by status {showFilterList ? '^' : 'v'}
          </button>
          {showFilterList && (
            <div className={styles.dropdownMenu} role="listbox">
              {techOptions.map((option) => (
                <label key={option.id} className={styles.dropdownItem}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(option.id)}
                    onChange={() => handleCheckboxChange(option.id)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
