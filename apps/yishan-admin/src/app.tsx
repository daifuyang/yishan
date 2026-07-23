import React, { type JSX, lazy } from "react";
import { BookOpen, ClipboardList, ContactRound, ExternalLink, FileText, FlaskConical, Folder, Hospital, Inbox, LayoutDashboard, Package, Send, Settings, ShoppingBag, Smile, type LucideIcon, UsersRound } from "lucide-react";
import type { Settings as LayoutSettings, MenuDataItem } from "@ant-design/pro-components";
import { PageLoading, SettingDrawer } from "@ant-design/pro-components";
import type { RequestConfig, RunTimeLayoutConfig } from "@umijs/max";
import { history, Link, Navigate } from "@umijs/max";
import {
  AvatarDropdown,
  AvatarName,
  Footer,
  Question,
  SelectLang,
} from "@/components";
import { getCurrentUser } from "@/services/generated/auth";
import { App as AntdApp } from "antd";
import defaultSettings from "../config/defaultSettings";
import { errorConfig } from "./requestErrorConfig";
import { getAuthorizedMenuTree } from "@/services/generated/sysMenus";
import { getDictDataMap } from "@/services/generated/sysDictData";
import type { CloudStorageConfig } from "@/utils/attachmentUpload";
import { fetchCloudStorageConfig, uploadAttachmentFile } from "@/utils/attachmentUpload";
import type { AttachmentKind, CurrentUser, MenuTreeList, MenuTreeNode, UploadAttachmentsResp } from "@/types/sdk";
import avatarFallback from "@public/icons/avatar.png";
import queryString from "query-string";
import { getBasePrefixFromPublicPath, stripBasePrefix } from "../shared/publicPath";
import { menuTreeToRoutes } from "@/utils/menuRoutes";

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
  experiment: FlaskConical,
  experimentoutlined: FlaskConical,
  flask: FlaskConical,
  flaskoutlined: FlaskConical,
  package: Package,
  packageoutlined: Package,
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
  currentUser?: CurrentUser;
  loading?: boolean;
  fetchUserInfo?: () => Promise<CurrentUser | undefined>;
  dictDataMap?: Record<string, any>;
  fetchDictDataMap?: () => Promise<Record<string, any> | undefined>;
  cloudStorageConfig?: CloudStorageConfig;
  authorizedMenuPaths?: string[];
  fetchCloudStorageConfig?: (options?: { force?: boolean }) => Promise<CloudStorageConfig>;
  uploadAttachmentFile?: (
    file: File,
    params: { folderId?: number; kind?: AttachmentKind; name?: string; dir?: string }
  ) => Promise<UploadAttachmentsResp>;
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
      // 数据源与 access.ts 的 canDo 完全一致（来自后端 /auth/me 的 currentUser.accessPath），
      // 不再依赖模块级 extraRoutes —— extraRoutes 在 render() 异步填充期间可能是空，
      // 而 account/center 等页面需要与访问控制同源的 path 白名单。
      authorizedMenuPaths: currentUser.accessPath ?? [],
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

let extraRoutes: MenuTreeList = [];
const clickableRoutePaths = new Set<string>();

const normalizeRoutePath = (path?: string) => {
  if (!path) return '';
  if (path === '/') return '/';
  return path.endsWith('/') ? path.slice(0, -1) : path;
};

const transformToMenuData = (nodes: MenuTreeNode[] = []): MenuDataItem[] => {

  const toItem = (n: MenuTreeNode): MenuDataItem => {
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
    links: (() => {
      const isSuperAdmin = initialState?.currentUser?.roleCodes?.includes('super_admin')
      const out: JSX.Element[] = []
      // 共享的图标-文字布局：flex + 居中 + 间距 + 颜色，跟 ProLayout 默认 link 风格对齐。
      const linkStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
      }
      if (isDev) {
        // 后端 Swagger UI：dev 下走 umi proxy(/api/** → :3000)，保持同源；
        // prod 下跟 /api 同站则继续工作，跨域需要后端 CORS 配置。
        out.push(
          <Link
            key="openapi"
            to="/api/docs/static/"
            target="_blank"
            rel="noreferrer"
            style={linkStyle}
          >
            <ExternalLink size={16} strokeWidth={1.8} />
            <span>OpenAPI 文档</span>
          </Link>,
        )
        if (isSuperAdmin) {
          out.push(
            <Link key="module-management" to="/system/module-management" style={linkStyle}>
              <Package size={16} strokeWidth={1.8} />
              <span>模块管理</span>
            </Link>,
          )
        }
      }
      return out
    })(),
    menuHeaderRender: undefined,
    // 自定义 403 页面
    // unAccessible: <div>unAccessible</div>,
    // 增加一个 loading 的状态
    childrenRender: (children) => {
      // 使用 antd App 提供上下文，避免 message 等静态方法的上下文警告
      if (initialState?.loading) return <PageLoading />;
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

    // 后端 sys_menu 驱动的业务路由：单一真相源，无需在 routes.ts 重复声明。
    // 按 path 去重，保留 routes.ts 中已声明的条目优先。
    const dynamicRoutes = menuTreeToRoutes(extraRoutes || []);
    const existingPaths = new Set(
      rootRoute.children.map((c: any) => c?.path).filter(Boolean),
    );
    for (const r of dynamicRoutes) {
      if (r.path && !existingPaths.has(r.path)) {
        rootRoute.children.push(r);
        existingPaths.add(r.path);
      } else if (!r.path && r.routes?.length) {
        // 目录节点没有 path：把它的 children 平铺到上一层
        for (const child of r.routes) {
          if (child.path && !existingPaths.has(child.path)) {
            rootRoute.children.push(child);
            existingPaths.add(child.path);
          }
        }
      }
    }

    const firstPath = resolveFirstPath(extraRoutes || []);
    if (firstPath !== '/') {
      rootRoute.children.unshift({
        id: '/', path: '/', element: <Navigate to={firstPath} replace />, redirect: firstPath
      });
    }

    // dev-only 「模块管理」：写死在 header 右上 links 区域,不进 sidebar 菜单。
    // 路由注册不做 super_admin 判定 —— patchClientRoutes 是同步钩子,
    // role 探测在 render() 的 async 流程里,跑 patchClientRoutes 时还没设置,
    // 会出 race → 404。改成:dev 下始终挂路由,可见性靠 layout.links 包一层;
    // URL 直访会被 page 内的 super_admin 校验弹到 /404。
    if (isDev) {
      const devPath = '/system/module-management'
      if (!existingPaths.has(devPath)) {
        rootRoute.children.push({
          id: 'dev-module-management',
          path: devPath,
          // 跟 menuTreeToRoutes 一样用 React.createElement 包一下,
          // 避免 umi 4 + React 19 把 lazy 函数当 Route children 渲染。
          element: React.createElement(lazy(() => import('@/pages/system/module-management'))) as unknown as JSX.Element,
        } as any)
        existingPaths.add(devPath)
      }
    }

    // 把注入的动态路由也纳入面包屑可点击路径集合
    walkRoutes(rootRoute.children);
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

  getAuthorizedMenuTree()
    .then((res) => {
      const menus = res.data || [];
      extraRoutes = menus;
      oldRender();
    })
    .catch((error: any) => {
      if (error?.response?.status === 401) {
        window.location.href = loginUrl;
        return;
      }
      extraRoutes = [];
      oldRender();
    });
}
