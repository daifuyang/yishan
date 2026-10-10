import clsx from 'clsx';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import FeatureGrid from '@yishan/docs-kit/components/FeatureGrid';
import styles from './index.module.css';

const features = [
  {title: 'Demo 产品快速开始', description: '从环境准备到本地运行，快速启动 Demo 产品。', iconSrc: '/img/undraw_docusaurus_mountain.svg'},
  {title: '系统功能开箱可用', description: '用户、角色、菜单、部门和岗位等基础能力可直接使用。', iconSrc: '/img/undraw_docusaurus_tree.svg'},
  {title: '产品文档就近维护', description: 'Demo 的用户说明和功能文档由 Demo 产品团队独立维护。', iconSrc: '/img/undraw_docusaurus_react.svg'},
];

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">{siteConfig.title}</Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <a className="button button--secondary button--lg" href="/docs/quick-start/run">快速开始</a>
        </div>
      </div>
    </header>
  );
}

export default function Home(): React.ReactNode {
  return (
    <Layout title="首页" description="移山 Demo 产品文档">
      <HomepageHeader />
      <main><FeatureGrid items={features} /></main>
    </Layout>
  );
}
