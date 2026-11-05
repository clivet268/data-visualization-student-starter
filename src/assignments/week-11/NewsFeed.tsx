import { useEffect, useState } from 'react';
import styles from './spillover.module.css';
import { SlidePanel } from './SlidePanel';
import { loadNews, type NewsItem } from './news';

export function NewsFeed() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    loadNews()
      .then((i) => alive && (setItems(i), setStatus('done')))
      .catch(() => alive && setStatus('error'));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <SlidePanel side="left" placement={styles.newsFeed}>
      <div className={styles.boxTitle}>News</div>
      <div className={styles.boxScroll}>
        {/*<div className={styles.contentbox}>
          <div className={styles.contentboxname}>
            Gelman Sciences Inc. site in Ann Arbor, Michigan
          </div>
          <div className={styles.contentboxvalue}>I descibe what happen and the site</div>
          <div className={styles.contentboxvalue}>
            <a href="https://www.washtenaw.org/14-dioxane">1,4-Dioxane[Saftey Information]</a>
          </div>
        </div>*/}

        <div className={styles.contentbox}>
          <div className={styles.contentboxname}>Latest publications</div>
          <ul className={`${styles.contentboxvalue} ${styles.contentlist}`}>
            {status === 'loading' && <li className={styles.muted}>Loading…</li>}
            {status !== 'loading' && items.length === 0 && (
              <li className={styles.muted}>News unavailable right now</li>
            )}
            {items.map((it) => (
              <li key={it.link} className={styles.contentlistitem}>
                <a href={it.link} target="_blank" rel="noreferrer">
                  {it.title}
                </a>{' '}
                {it.id && <span className={styles.badge}>{it.id}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SlidePanel>
  );
}