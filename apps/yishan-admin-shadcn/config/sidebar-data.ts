import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  FileText, 
  BarChart3,
  Shield
} from "lucide-react"

export const yishanSidebarData = {
  user: {
    name: "管理员",
    email: "admin@yishan.com",
    avatar: "/avatars/admin.png",
  },
  teams: [
    {
      name: "一山系统",
      logo: Shield,
      plan: "企业版",
    },
  ],
  navMain: [
    {
      title: "控制台",
      url: "/admin/dashboard",
      icon: LayoutDashboard,
      isActive: true,
      items: [
        {
          title: "概览",
          url: "/admin/dashboard",
        },
        {
          title: "统计",
          url: "/admin/dashboard/analytics",
        },
      ],
    },
    {
      title: "用户管理",
      url: "/admin/users",
      icon: Users,
      items: [
        {
          title: "用户列表",
          url: "/admin/users",
        },
        {
          title: "角色权限",
          url: "/admin/users/roles",
        },
        {
          title: "操作日志",
          url: "/admin/users/logs",
        },
      ],
    },
    {
      title: "内容管理",
      url: "/admin/content",
      icon: FileText,
      items: [
        {
          title: "文章管理",
          url: "/admin/content/articles",
        },
        {
          title: "分类管理",
          url: "/admin/content/categories",
        },
        {
          title: "标签管理",
          url: "/admin/content/tags",
        },
      ],
    },
    {
      title: "系统设置",
      url: "/admin/settings",
      icon: Settings,
      items: [
        {
          title: "基础设置",
          url: "/admin/settings/general",
        },
        {
          title: "安全配置",
          url: "/admin/settings/security",
        },
        {
          title: "通知设置",
          url: "/admin/settings/notifications",
        },
      ],
    },
  ],
  projects: [
    {
      name: "数据分析",
      url: "/admin/analytics",
      icon: BarChart3,
    },
  ],
}