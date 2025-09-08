import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';
import Heading from '@theme/Heading';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Next.js 15 架构',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        基于最新的Next.js 15 App Router，提供卓越的服务端渲染和静态生成能力，
        支持TypeScript和Edge Runtime，性能提升3倍。
      </>
    ),
  },
  {
    title: 'TypeScript 全栈',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        端到端TypeScript支持，提供完整的类型安全和智能提示，
        减少运行时错误，提升开发效率50%。
      </>
    ),
  },
  {
    title: '企业级组件库',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        50+高质量可复用组件，涵盖数据展示、表单、导航、反馈等类别，
        支持主题定制和国际化，开箱即用。
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

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          <div className="col col--12 text--center">
            <Heading as="h2" className="hero__title">
              核心特性
            </Heading>
            <p className="hero__subtitle">
              现代化的企业级开发体验
            </p>
          </div>
        </div>
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
