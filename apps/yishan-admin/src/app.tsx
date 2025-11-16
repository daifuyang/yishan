import { LinkOutlined, SettingOutlined } from "@ant-design/icons";
import type { Settings as LayoutSettings, MenuDataItem } from "@ant-design/pro-components";
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
import { getAuthorizedMenuTree } from "@/services/yishan-admin/sysMenus";
import React from "react";

const isDev = process.env.NODE_ENV === "development";
const loginPath = "/user/login";

const IconMap: Record<string, React.ReactNode> = {
  setting: <SettingOutlined />,
};

/**
 * @see https://umijs.org/docs/api/runtime-config#getinitialstate
 * */
export async function getInitialState(): Promise<{
  settings?: Partial<LayoutSettings>;
  currentUser?: API.userProfile;
  loading?: boolean;
  fetchUserInfo?: () => Promise<API.userProfile | undefined>;
  fetchMenus?: () => Promise<MenuDataItem[] | undefined>;
}> {
  const fetchUserInfo = async () => {
    const response = await getCurrentUser();
    if (response.success && response.data) {
      return response.data;
    }
    return undefined;
  };

  const transformToMenuData = (nodes: API.menuTreeNode[] = []): MenuDataItem[] => {

    const toItem = (n: API.menuTreeNode): MenuDataItem => {
      const item: MenuDataItem = {
        name: n.name,
        path: n.path,
        icon: n.icon ? IconMap[String(n.icon).toLowerCase()] : undefined,
        hideInMenu: n.hideInMenu,
      };
      if (Array.isArray(n.children) && n.children.length) {
        item.children = transformToMenuData(n.children);
      }
      return item;
    };
    return nodes.filter((n) => n.type !== 2).map(toItem);
  };

  const fetchMenus = async () => {
    try {
      const res = await getAuthorizedMenuTree();
      const data = res?.data || [];
      return transformToMenuData(data);
    } catch {
      return undefined;
    }
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
      fetchMenus,
      currentUser,
      settings: defaultSettings as Partial<LayoutSettings>,
    };
  }
  return {
    fetchUserInfo,
    fetchMenus,
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
      params: {
        userId: initialState?.currentUser?.id,
      },
      // 从服务器加载菜单
      request: async (params) => {
        if (!params?.userId) return [];
        const menus = await initialState?.fetchMenus?.();
        return menus || [];
      },
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

type Route = {
  id: string;
  path: string;
  type?: 0 | 1 | 2;
  name?: string;
  component?: string;
  children?: Route[];
  redirect?: string;
  element?: React.ReactNode;
};

const resolveFirstPath = (routes: Route[] = []): string => {
  if (!Array.isArray(routes) || routes.length === 0) return "/";
  const routeMap = new Map<string, Route>();
  const build = (list: Route[] = []) => {
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
   const rootRoute = routes.find((r: any) => r.path === '/');
  if (rootRoute && rootRoute.children.length > 0) {
    const firstPath = resolveFirstPath(rootRoute.children || []);
    rootRoute.children.unshift({
      id: '/', path: '/', element: <Navigate to={firstPath} replace />, redirect: firstPath
    });
  }
}
