import { BookOpen, ClipboardList, ContactRound, ExternalLink, FileText, Folder, Hospital, Inbox, LayoutDashboard, Send, Settings, ShoppingBag, Smile, type LucideIcon, UsersRound } from "lucide-react";
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
import avatarFallback from "@public/icons/avatar.png";
import queryString from "query-string";
import { getBasePrefixFromPublicPath, stripBasePrefix } from "../shared/publicPath";

const isDev = process.env.NODE_ENV === "development";
const loginPath = "/user/login";
const ADMIN_BASE = getBasePrefixFromPublicPath(__APP_BASE__);

const getRelativePath = (pathname: string) => {
  return stripBasePrefix(pathname, ADMIN_BASE);
};

const isLoginRoute = (pathname: string) => getRelativePath(pathname) === loginPath;

const IconMap: Record<string, LucideIcon> = {
  appstore: LayoutDashboard,
  appstoreoutlined: LayoutDashboard,
  setting: Settings,
  settingoutlined: Settings,
  smile: Smile,
  smileoutlined: Smile,
  read: BookOpen,
  readoutlined: BookOpen,
  shopping: ShoppingBag,
  folder: Folder,
  inbox: Inbox,
  'file-text': FileText,
  'medicine-box': Hospital,
  hospital: Hospital,
  medicineboxoutlined: Hospital,
  team: UsersRound,
  'users-round': UsersRound,
  teamoutlined: UsersRound,
  idcard: ContactRound,
  'contact-round': ContactRound,
  idcardoutlined: ContactRound,
  send: Send,
  sendoutlined: Send,
  'clipboard-list': ClipboardList,
};
function pickIcon(key: string): JSX.Element | undefined {
  const Icon = IconMap[String(key).toLowerCase()];
  return Icon ? <Icon size={16} strokeWidth={1.8} /> : undefined;
}

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
  authorizedMenuPaths?: string[];
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
  const currentPath = getRelativePath(location.pathname);
  if (![loginPath, "/user/register"].includes(currentPath)) {
    const currentUser = await fetchUserInfo();
    if (!currentUser) {
      return {
        fetchUserInfo,
        fetchDictDataMap,
        fetchCloudStorageConfig,
        uploadAttachmentFile,
        settings: defaultSettings as Partial<LayoutSettings>,
      };
    }
    const [dictDataMap, cloudStorageConfig] = await Promise.all([
      fetchDictDataMap(),
      fetchCloudStorageConfig()
    ]);

    return {
      fetchUserInfo,
      fetchDictDataMap,
      fetchCloudStorageConfig,
      uploadAttachmentFile,
      currentUser,
      dictDataMap,
      cloudStorageConfig,
      authorizedMenuPaths: collectAuthorizedMenuPaths(extraRoutes),
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
const clickableRoutePaths = new Set<string>();

const collectAuthorizedMenuPaths = (nodes: API.menuTreeList = []): string[] => {
  const paths: string[] = [];
  const visit = (items: API.menuTreeList) => {
    for (const item of items) {
      if (item.path) paths.push(normalizeRoutePath(item.path));
      if (item.children?.length) visit(item.children);
    }
  };
  visit(nodes);
  return paths;
};

const normalizeRoutePath = (path?: string) => {
  if (!path) return '';
  if (path === '/') return '/';
  return path.endsWith('/') ? path.slice(0, -1) : path;
};

const transformToMenuData = (nodes: API.menuTreeNode[] = []): MenuDataItem[] => {

  const toItem = (n: API.menuTreeNode): MenuDataItem => {
    const item: MenuDataItem = {
      name: n.name,
      path: n.path || '/',
      icon: n.icon ? pickIcon(String(n.icon)) : undefined,
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
      src: initialState?.currentUser?.avatar || avatarFallback,
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
      const currentPath = getRelativePath(location.pathname);
      if (!initialState?.currentUser && currentPath !== loginPath) {
        history.push(loginPath);
      }
    },
    itemRender: (route, _, routes) => {
      const label = route.title || route.breadcrumbName;
      if (!label) return null;

      const normalizedPath = normalizeRoutePath(route.path);
      const index = routes.indexOf(route);
      const isMiddle = index > 0 && index < routes.length - 1;
      const canLink = isMiddle && normalizedPath.startsWith('/') && clickableRoutePaths.has(normalizedPath);

      return canLink ? <Link to={normalizedPath}>{label}</Link> : <span>{label}</span>;
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
          <ExternalLink size={16} strokeWidth={1.8} />
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
  // 允许跨域请求携带 HttpOnly 认证 cookie（同源请求默认即会携带，此项对同源无副作用）。
  // 跨域场景（admin.* -> api.*）下后端需回显具体 origin 并返回 Access-Control-Allow-Credentials: true。
  withCredentials: true,
  paramsSerializer(params) {
    return queryString.stringify(params);
  },
  ...errorConfig,
};

const resolveFirstPath = (nodes: any[] = []): string => {
  if (!Array.isArray(nodes) || nodes.length === 0) return '/';
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
  const originalPath = typeof current?.path === "string" && current.path ? current.path : '/';
  return originalPath;
};

export function patchClientRoutes({ routes }: { routes: any[] }) {
  clickableRoutePaths.clear();

  const walkRoutes = (items: any[] = []) => {
    items.forEach((route) => {
      const normalizedPath = normalizeRoutePath(route?.path);
      const hasRenderableElement = Boolean(route?.element || route?.Component);
      if (
        normalizedPath?.startsWith('/') &&
        normalizedPath !== '*' &&
        !normalizedPath.includes(':') &&
        !normalizedPath.includes('*') &&
        hasRenderableElement
      ) {
        clickableRoutePaths.add(normalizedPath);
      }

      if (Array.isArray(route?.children) && route.children.length > 0) {
        walkRoutes(route.children);
      }
    });
  };

  walkRoutes(routes);

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
    if (firstPath !== '/') {
      rootRoute.children.unshift({
        id: '/', path: '/', element: <Navigate to={firstPath} replace />, redirect: firstPath
      });
    }
  }
}

export function render(oldRender: () => void) {
  const currentPath = window.location.pathname;
  const loginUrl = `${ADMIN_BASE}/user/login`;
  // 认证态由 HttpOnly cookie 承载（JS 不可读），登录页直接渲染；
  // 其余路由先尝试拉取授权菜单树，未认证时后端返回 401 -> 跳转登录页。
  if (isLoginRoute(currentPath)) {
    oldRender();
    return;
  }

  getAuthorizedMenuTree().then((res) => {
    const menus = res.data || [];
    extraRoutes = menus;
    oldRender();
  }).catch((error: any) => {
    if (error?.response?.status === 401) {
      window.location.href = loginUrl;
      return;
    }
    extraRoutes = [];
    oldRender();
  });
}
