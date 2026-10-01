import { useEffect, useState, useRef } from 'react';
import styles from './spillover.module.css';

export function TitleBar() {
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

      onChange(updated);
      return updated;
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`${styles.titleBar} ${styles.spilloverlay}`}>
      <div className={styles.title}>Spillover</div>
      <div>
        <div>
          <div>
            Focus selected event
            <input type="checkbox" />
          </div>
          <div className={styles.statusFilter} ref={dropdownRef}>
            <button
              onClick={() => setFilterListShow(!showFilterList)}
              className={styles.filterButton}
            >
              Filter by status {showFilterList ? '^' : 'v'}
            </button>
            {showFilterList && (
              <div className="dropdown-menu" role="listbox">
                {techOptions.map((option) => {
                  const isChecked = selectedIds.includes(option.id);
                  return (
                    <label
                      key={option.id}
                      className={`dropdown-item ${isChecked ? 'selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleCheckboxChange(option.id)}
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
