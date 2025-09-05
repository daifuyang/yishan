import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
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
          <Link
            className="button button--primary button--lg"
            to="/docs/introduction">
            快速开始 🚀
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/docs/admin"
            style={{marginLeft: '1rem'}}>
            管理后台 📊
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/docs/components"
            style={{marginLeft: '1rem'}}>
            组件库 🧩
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} - 现代化全栈开发平台`}
      description="基于Next.js + TypeScript + Tailwind CSS的现代化全栈开发平台，包含管理后台、组件库和完整文档">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
