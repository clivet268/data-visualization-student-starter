import { useEffect, useState } from 'react';
import styles from './spillover.module.css';
import { SlidePanel } from './SlidePanel';
import { loadNews, type NewsData, type NewsItem } from './news';

const PREVIEW = 2; // what a collapsed section shows
const STEP = 10; // each expand reveals this many more

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

interface SectionProps {
  title: string;
  items: NewsItem[];
  loading: boolean;
  initial: number; // how many items show before anything is clicked
}

function FeedSection({ title, items, loading, initial }: SectionProps) {
  const [shown, setShown] = useState(initial);
  const canMore = shown < items.length;
  const canCollapse = shown > PREVIEW;

  return (
    <div className={styles.contentbox}>
      <div className={styles.contentboxname}>{title}</div>
      <div className={styles.contentboxvalue}>
        {loading && <div className={styles.muted}>Loading…</div>}
        {!loading && items.length === 0 && <div className={styles.muted}>Nothing available right now</div>}
        <ul className={styles.contentlist}>
          {items.slice(0, shown).map((it) => (
            <li key={it.link} className={styles.contentlistitem}>
              <a href={it.link} target="_blank" rel="noreferrer">
                {it.title}
              </a>
              {it.date !== null && <div className={styles.muted}>{fmtDate(it.date)}</div>}
            </li>
          ))}
        </ul>
      </div>
      {(canMore || canCollapse) && (
        <div className={styles.contentboxvalue}>
          <div className={styles.titleGroup}>
            {canMore && (
              <button type="button" className={styles.groupButton} onClick={() => setShown(shown + STEP)}>
                Show {Math.min(STEP, items.length - shown)} more
              </button>
            )}
            {canCollapse && (
              <button type="button" className={styles.groupButton} onClick={() => setShown(PREVIEW)}>
                Collapse
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function NewsFeed() {
  const [data, setData] = useState<NewsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    loadNews()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {
        /* sections show their empty message */
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
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

        <FeedSection title="Latest events" items={data?.latest ?? []} loading={loading} initial={PREVIEW} />
        <FeedSection title="Superfund" items={data?.superfund ?? []} loading={loading} initial={STEP} />
      </div>
    </SlidePanel>
  );
}
