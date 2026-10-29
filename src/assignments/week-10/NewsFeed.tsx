import styles from './spillover.module.css';
import { SlidePanel } from './SlidePanel';
export function NewsFeed() {
  return (
    <SlidePanel side="left" placement={styles.newsFeed}>
      <div className={styles.boxTitle}>News</div>
      <div className={styles.boxScroll}>
        <div className={styles.contentbox}>
          <div className={styles.contentboxname}>
            Gelman Sciences Inc. site in Ann Arbor, Michigan
          </div>
          <div className={styles.contentboxvalue}>I descibe what happen and the site</div>
          <div className={styles.contentboxvalue}>
            <a href="https://www.mlive.com/news/ann-arbor/2026/08/epa-to-hold-first-gelman-plume-workshop-for-community-west-of-ann-arbor-next-week.html"></a>
            <a href="https://www.washtenaw.org/14-dioxane">1,4-Dioxane[Saftey Information]</a>
          </div>
        </div>
      </div>
      </SlidePanel>
  );
}
