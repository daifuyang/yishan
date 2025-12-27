import { LinkOutlined, ReadOutlined, SettingOutlined } from "@ant-design/icons";
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
import { App as AntdApp } from "antd";
import defaultSettings from "../config/defaultSettings";
import { errorConfig } from "./requestErrorConfig";
import { getAuthorizedMenuTree } from "@/services/yishan-admin/sysMenus";
import { getDictDataMap } from "@/services/yishan-admin/sysDictData";
import type { CloudStorageConfig } from "@/utils/attachmentUpload";
import { fetchCloudStorageConfig, uploadAttachmentFile } from "@/utils/attachmentUpload";
import React from "react";

const isDev = process.env.NODE_ENV === "development";
const isDevOrTest = isDev || process.env.CI;
const loginPath = "/user/login";

const IconMap: Record<string, React.ReactNode> = {
  setting: <SettingOutlined />,
  read: <ReadOutlined />,
};

/**
 * @see https://umijs.org/docs/api/runtime-config#getinitialstate
 * */
export async function getInitialState(): Promise<{
  settings?: Partial<LayoutSettings>;
  currentUser?: API.currentUser;
  loading?: boolean;
  fetchUserInfo?: () => Promise<API.currentUser | undefined>;
  dictDataMap?: Record<string, any>;
  fetchDictDataMap?: () => Promise<Record<string, any> | undefined>;
  cloudStorageConfig?: CloudStorageConfig;
  fetchCloudStorageConfig?: (options?: { force?: boolean }) => Promise<CloudStorageConfig>;
  uploadAttachmentFile?: (
    file: File,
    params: { folderId?: number; kind?: API.sysAttachment["kind"]; name?: string; dir?: string }
  ) => Promise<API.uploadAttachmentsResp>;
}> {
  const fetchUserInfo = async () => {
    const response = await getCurrentUser();
    if (response.success && response.data) {
      return response.data;
    }
    return undefined;
  };

  const fetchDictDataMap = async () => {
    try {
      const res = await getDictDataMap();
      if (res.success && res.data) {
        return res.data;
      }
      return {};
    } catch {
      return {};
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
    const dictDataMap = await fetchDictDataMap();
    const cloudStorageConfig = await fetchCloudStorageConfig();

    return {
      fetchUserInfo,
      fetchDictDataMap,
      fetchCloudStorageConfig,
      uploadAttachmentFile,
      currentUser,
      dictDataMap,
      cloudStorageConfig,
      settings: defaultSettings as Partial<LayoutSettings>,
    };
  }
  return {
    fetchUserInfo,
    fetchDictDataMap,
    fetchCloudStorageConfig,
    uploadAttachmentFile,
    settings: defaultSettings as Partial<LayoutSettings>,
  };
}

let extraRoutes: API.menuTreeList = [];

const transformToMenuData = (nodes: API.menuTreeNode[] = []): MenuDataItem[] => {

  const toItem = (n: API.menuTreeNode): MenuDataItem => {
    const item: MenuDataItem = {
      name: n.name,
      path: n.path,
      icon: n.icon ? (IconMap[String(n.icon).toLowerCase()] as any) : undefined,
      hideInMenu: n.hideInMenu,
    };
    if (Array.isArray(n.children) && n.children.length) {
      item.children = transformToMenuData(n.children);
    }
    return item;
  };
  return nodes.filter((n) => n.type !== 2).map(toItem);
};

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
        return transformToMenuData(extraRoutes || []);
      },
    },
    footerRender: () => <Footer />,
    onPageChange: () => {
      const { location } = history;
      // 如果没有登录，重定向到 login
      if (!initialState?.currentUser && location.pathname !== loginPath) {
        history.push(loginPath);
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
    links: isDevOrTest
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
          {isDevOrTest && (
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

const resolveFirstPath = (nodes: any[] = []): string => {
  if (!Array.isArray(nodes) || nodes.length === 0) return "/";
  const isValid = (n: any) => n && n.status !== "0" && !n.isExternalLink && n.type !== 2 && !n.hideInMenu;
  const getChildren = (n: any) => (Array.isArray(n?.children) ? n.children : []);
  const pickFirst = (list: any[] = []) => (list || []).find(isValid) ?? (list || [])[0];
  let current = pickFirst(nodes);
  while (current) {
    const children = (getChildren(current) || []).filter(isValid);
    if (children.length > 0) {
      current = children[0];
      continue;
    }
    break;
  }
  return typeof current?.path === "string" && current.path ? current.path : "/";
};

export function patchClientRoutes({ routes }: { routes: any[] }) {
  const rootRoute = routes.find((r: any) => r.path === '/');
  if (rootRoute) {
    if (!rootRoute.children) {
      rootRoute.children = [];
    }
    // 如果rootRoute.children包含/, 则删除
    if (rootRoute.children.find((r: any) => r.path === '/')) {
      rootRoute.children = rootRoute.children.filter((r: any) => r.path !== '/');
    }
    const firstPath = resolveFirstPath(extraRoutes || []);
    rootRoute.children.unshift({
      id: '/', path: '/', element: <Navigate to={firstPath} replace />, redirect: firstPath
    });
  }
}

export function render(oldRender: any) {
  const currentPath = window.location.pathname;
  if (currentPath !== '/user/login') {
    getAuthorizedMenuTree().then((res) => {
      const menus = res.data || [];
      extraRoutes = menus;
      oldRender();
    });
  } else {
    oldRender();
  }
}
