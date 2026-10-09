import type { ProLayoutProps } from '@ant-design/pro-components';
import { normalizePublicPath } from '../shared/publicPath';

// 配置文件在构建阶段由 Node 执行，运行时则由 Umi 注入 __APP_BASE__。
// 两个入口均从同一个 PUBLIC_PATH 推导，避免 public 资源在 /admin/ 部署时回退到站点根目录。
const publicPath =
  typeof __APP_BASE__ === 'string'
    ? __APP_BASE__
    : process.env.PUBLIC_PATH || '/';

/**
 * @name
 */
const Settings: ProLayoutProps & {
  pwa?: boolean;
  logo?: string;
} = {
  navTheme: 'light',
  // 拂晓蓝
  colorPrimary: '#1890ff',
  layout: 'mix',
  contentWidth: 'Fluid',
  fixedHeader: false,
  fixSiderbar: true,
  colorWeak: false,
  title: '移山后台管理系统',
  pwa: true,
  logo: `${normalizePublicPath(publicPath)}logo.svg`,
  iconfontUrl: '',
  token: {
    // 参见ts声明，demo 见文档，通过token 修改样式
    //https://procomponents.ant.design/components/layout#%E9%80%9A%E8%BF%87-token-%E4%BF%AE%E6%94%B9%E6%A0%B7%E5%BC%8F
  },
};

export default Settings;
