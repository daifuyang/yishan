
import clsx from 'clsx';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <a
            className="button button--secondary button--lg"
            href="/docs/quick-start/run">
            快速开始
          </a>
          <a
            className="button button--outline button--lg"
            style={{marginLeft: 12}}
            href="/docs/frontend/overview">
            前端文档
          </a>
          <a
            className="button button--outline button--lg"
            style={{marginLeft: 12}}
            href="/docs/api/overview">
            后端文档
          </a>
        </div>
      </div>
    </header>
  );
}

export default function Home(): React.ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title="首页"
      description="移山后台管理系统文档站首页">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
