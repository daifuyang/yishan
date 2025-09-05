import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: '现代化技术栈',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        基于Next.js 15 + TypeScript + Tailwind CSS构建，提供最佳的开发体验
        和性能表现，支持服务端渲染和静态生成。
      </>
    ),
  },
  {
    title: '完整的组件库',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        基于shadcn/ui的丰富组件库，包含基础UI、表单、数据展示等各类组件，
        支持深色模式和主题定制。
      </>
    ),
  },
  {
    title: '企业级管理后台',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        功能完整的企业级管理后台模板，包含用户管理、权限控制、数据可视化
        等核心功能，开箱即用。
      </>
    ),
  },
];

function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
