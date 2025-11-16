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
    title: '前后端分离架构',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        前端基于 Umi Max + Ant Design Pro，后端基于 Fastify + Prisma，模块清晰、职责明确。
      </>
    ),
  },
  {
    title: '统一业务码与响应',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        标准化 <code>success/code/message/data/timestamp</code> 输出与分页结构，前端处理更简单稳定。
      </>
    ),
  },
  {
    title: '完善认证与缓存',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        JWT 访问/刷新令牌与 Redis 缓存策略，支持令牌撤销与自动刷新，性能与安全兼顾。
      </>
    ),
  },
  {
    title: '模块即插即用',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        用户、角色、菜单、部门、岗位等通用模块开箱可用，权限以路径为核心，搭配 <code>accessPath</code> 控制。
      </>
    ),
  },
  {
    title: '开发体验友好',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        请求拦截与错误处理、自动刷新令牌、TypeScript 与 Biome Lint，全链路提升开发效率与质量。
      </>
    ),
  },
  {
    title: '文档与示例完善',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        Docusaurus 文档与 Swagger UI 结合，示例与规范齐备，便于团队协作与扩展。
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
