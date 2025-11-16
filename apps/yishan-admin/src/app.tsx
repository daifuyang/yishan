import { LinkOutlined } from "@ant-design/icons";
import type { Settings as LayoutSettings } from "@ant-design/pro-components";
import { SettingDrawer } from "@ant-design/pro-components";
import type { RequestConfig, RunTimeLayoutConfig } from "@umijs/max";
import { history, Link, Navigate } from "@umijs/max";
import {
  AvatarDropdown,
  AvatarName,
  Footer,
  Question,
  SelectLang,
} from "@/components";
import { getCurrentUser } from "@/services/yishan-admin/auth";
import { App as AntdApp, Spin } from "antd";
import defaultSettings from "../config/defaultSettings";
import { errorConfig } from "./requestErrorConfig";
import "@ant-design/v5-patch-for-react-19";
import { getMenuTree } from "@/services/yishan-admin/sysMenus";
import React from "react";

const isDev = process.env.NODE_ENV === "development";
const loginPath = "/user/login";

/**
 * @see https://umijs.org/docs/api/runtime-config#getinitialstate
 * */
export async function getInitialState(): Promise<{
  settings?: Partial<LayoutSettings>;
  currentUser?: API.userProfile;
  loading?: boolean;
  fetchUserInfo?: () => Promise<API.userProfile | undefined>;
}> {
  const fetchUserInfo = async () => {
    const response = await getCurrentUser();
    if (response.success && response.data) {
      return response.data;
    }
    return undefined;
  };
  // 如果不是登录页面，执行
  const { location } = history;
  if (
    ![loginPath, "/user/register"].includes(
      location.pathname
    )
  ) {
    const currentUser = await fetchUserInfo();

    return {
      fetchUserInfo,
      currentUser,
      settings: defaultSettings as Partial<LayoutSettings>,
    };
  }
  return {
    fetchUserInfo,
    settings: defaultSettings as Partial<LayoutSettings>,
  };
}

// ProLayout 支持的api https://procomponents.ant.design/components/layout
export const layout: RunTimeLayoutConfig = ({
  initialState,
  setInitialState,
}) => {
  return {
    actionsRender: () => [
      <Question key="doc" />,
      <SelectLang key="SelectLang" />,
    ],
    avatarProps: {
      src: initialState?.currentUser?.avatar || "/icons/avatar.png",
      title: <AvatarName />,
      render: (_, avatarChildren) => {
        return <AvatarDropdown>{avatarChildren}</AvatarDropdown>;
      },
    },
    menu: {
      locale: false,
    },
    waterMarkProps: {
      content: initialState?.currentUser?.username,
    },
    footerRender: () => <Footer />,
    onPageChange: () => {
      const { location } = history;
      // 如果没有登录，重定向到 login
      if (!initialState?.currentUser && location.pathname !== loginPath) {
        // history.push(loginPath);
      }
    },
    bgLayoutImgList: [
      {
        src: "https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/D2LWSqNny4sAAAAAAAAAAAAAFl94AQBr",
        left: 85,
        bottom: 100,
        height: "303px",
      },
      {
        src: "https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/C2TWRpJpiC0AAAAAAAAAAAAAFl94AQBr",
        bottom: -68,
        right: -45,
        height: "303px",
      },
      {
        src: "https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/F6vSTbj8KpYAAAAAAAAAAAAAFl94AQBr",
        bottom: 0,
        left: 0,
        width: "331px",
      },
    ],
    links: isDev
      ? [
        <Link key="openapi" to="/umi/plugin/openapi" target="_blank">
          <LinkOutlined />
          <span>OpenAPI 文档</span>
        </Link>,
      ]
      : [],
    menuHeaderRender: undefined,
    // 自定义 403 页面
    // unAccessible: <div>unAccessible</div>,
    // 增加一个 loading 的状态
    childrenRender: (children) => {
      // 使用 antd App 提供上下文，避免 message 等静态方法的上下文警告
      // if (initialState?.loading) return <PageLoading />;
      return (
        <AntdApp>
          {children}
          {isDev && (
            <SettingDrawer
              disableUrlParams
              enableDarkTheme
              settings={initialState?.settings}
              onSettingChange={(settings) => {
                setInitialState((preInitialState) => ({
                  ...preInitialState,
                  settings,
                }));
              }}
            />
          )}
        </AntdApp>
      );
    },
    ...initialState?.settings,
  };
};

/**
 * @name request 配置，可以配置错误处理
 * 它基于 axios 和 ahooks 的 useRequest 提供了一套统一的网络请求和错误处理方案。
 * @doc https://umijs.org/docs/max/request#配置
 */
export const request: RequestConfig = {
  ...errorConfig,
};

let extraRoutes: any[] = [];

type UmiRoute = {
  id: string;
  path: string;
  type?: 0 | 1 | 2;
  name?: string;
  component?: string;
  children?: UmiRoute[];
  redirect?: string;
  element?: React.ReactNode;
};

const Wrapper = ({ children }: any) => (
  <React.Suspense>{children}</React.Suspense>
)

// 保留原层级递归，将extraRoutes中的路由替换为systemRoutesMap中的路由
const recursiveRoutes = (routes: UmiRoute[] = []): UmiRoute[] => {
  if (!Array.isArray(routes) || routes.length === 0) return [];
  const acc: UmiRoute[] = [];
  routes.forEach((item) => {

    const newItem: UmiRoute = { id: item.path, path: item.path, name: item.name, children: item.children };
    if (item.type === 1) {

      // 使用 require 动态加载组件，避免动态 import 的模块系统限制
      // 兼容一下item.component有可能是./开头的情况，也有可能是/开头的情况
      item.component = item.component?.replace(/^\.?\//, '');

      const Component = React.lazy(() =>
        Promise.resolve(require(`./pages/${item.component}`))
      );

      newItem.element = <Wrapper><Component /></Wrapper>;
    }

    if (item.children) {
      const childRoutes = recursiveRoutes(item.children || []);
      if (item.type === 0) {
        const path = item.children[0].path;
        childRoutes.unshift({
          id: item.path, path: item.path, element: <Navigate to={path} replace />, redirect: path
        });
      }
      newItem.children = childRoutes;
    }
    acc.push(newItem);
  });
  return acc;
};

const resolveFirstPath = (routes: UmiRoute[] = []): string => {
  if (!Array.isArray(routes) || routes.length === 0) return "/";
  const routeMap = new Map<string, UmiRoute>();
  const build = (list: UmiRoute[] = []) => {
    list.forEach((r) => {
      if (r?.path) routeMap.set(r.path, r);
      if (Array.isArray(r.children)) build(r.children);
    });
  };
  build(routes);

  let path = routes[0].redirect || routes[0].path || "/";
  const visited = new Set<string>();
  while (path && !visited.has(path)) {
    visited.add(path);
    const n = routeMap.get(path);
    if (n && n.redirect && n.redirect !== path) {
      path = n.redirect;
      continue;
    }
    break;
  }
  return path || "/";
};

export function patchClientRoutes({ routes }: { routes: any[] }) {
  if (!Array.isArray(extraRoutes) || extraRoutes.length === 0) return;
  // 找到路由为/的路由
  const rootRoute = routes.find((r: any) => r.path === '/');
  if (rootRoute) {
    // 递归extraRoutes
    const systemRoutes = recursiveRoutes(extraRoutes);
    if (!rootRoute.children) rootRoute.children = [];

    const firstPath = resolveFirstPath(systemRoutes);
    systemRoutes.unshift({ id: '/', path: '/', element: <Navigate to={firstPath} replace />, redirect: firstPath });
    rootRoute.children.push(...systemRoutes);
  }
}

export function render(oldRender: () => void) {
  getMenuTree()
    .then((res) => {
      extraRoutes = (res as any)?.data || [];
    })
    .finally(() => {
      oldRender();
    });
}
