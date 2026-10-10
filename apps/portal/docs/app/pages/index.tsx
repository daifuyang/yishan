import clsx from 'clsx';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import FeatureGrid from '@yishan/docs-kit/components/FeatureGrid';
import styles from './index.module.css';

const features = [
  {title: '稳定 API 契约', description: '从 TypeBox 到 OpenAPI 和生成客户端，平台契约保持闭环。', iconSrc: '/img/undraw_docusaurus_mountain.svg'},
  {title: '模块扩展能力', description: '按公开模块契约接入路由、权限、菜单、seed 和迁移。', iconSrc: '/img/undraw_docusaurus_tree.svg'},
  {title: '产品独立装配', description: 'Demo、CRM 和未来产品可以在各自应用中组合平台能力。', iconSrc: '/img/undraw_docusaurus_react.svg'},
];

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">{siteConfig.title}</Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <a className="button button--secondary button--lg" href="/docs/api/overview">API 文档</a>
        </div>
      </div>
    </header>
  );
}

export default function Home(): React.ReactNode {
  return (
    <Layout title="首页" description="移山平台开发者文档">
      <HomepageHeader />
      <main><FeatureGrid items={features} /></main>
    </Layout>
  );
}
