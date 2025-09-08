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
        <p className="hero__subtitle">
          企业级全栈开发平台 · 开箱即用
        </p>
        <div className={styles.buttons}>
          <Link
            className="button button--primary button--lg"
            to="/docs/guide/quick-start">
            开始使用
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/docs/guide/">
            文档中心
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
      title={`${siteConfig.title} - 企业级全栈开发平台`}
      description="基于Next.js 15 + TypeScript构建的现代化全栈开发平台，提供完整的企业级后台管理解决方案">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
