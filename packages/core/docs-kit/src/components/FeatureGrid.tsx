import clsx from 'clsx';
import styles from '../../theme/feature-grid.module.css';

export interface FeatureGridItem {
  title: string;
  description: string;
  iconSrc?: string;
}

function Feature({title, iconSrc, description}: FeatureGridItem) {
  return (
    <div className={clsx('col col--4')}>
      {iconSrc ? <div className="text--center"><img className={styles.featureSvg} src={iconSrc} alt="" /></div> : null}
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function FeatureGrid({items}: {items: FeatureGridItem[]}) {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">{items.map((item) => <Feature key={item.title} {...item} />)}</div>
      </div>
    </section>
  );
}
