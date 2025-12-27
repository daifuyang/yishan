declare namespace API {
  type aliyunOssConfigSchema = {
    provider?: "aliyunOss";
    accessKeyId?: string;
    accessKeySecret?: string;
    bucket?: string;
    region?: string;
    endpoint?: string;
    domain?: string;
    useHttps?: boolean;
  };

  type articleDeleteResp = {
    code: number;
    message: string;
    success: boolean;
    data: { id: number };
    timestamp: string;
  };

  type articleDetailResp = {
    code: number;
    message: string;
    success: boolean;
    data: portalArticle;
    timestamp: string;
  };

  type articleListQuery = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（标题、摘要、内容） */
    keyword?: string;
    /** 状态 */
    status?: "0" | "1";
    /** 分类ID过滤 */
    categoryId?: number;
    /** 开始时间 */
    startTime?: string;
    /** 结束时间 */
    endTime?: string;
    /** 排序字段 */
    sortBy?: "createdAt" | "updatedAt" | "publishTime";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type articleListResp = {
    code: number;
    message: string;
    success: boolean;
    data: portalArticle[];
    timestamp: string;
    pagination: paginationResponse;
  };

  type assignArticleTemplateParams = {
    /** 文章ID */
    id: number;
  };

  type assignPageTemplateParams = {
    /** 页面ID */
    id: number;
  };

  type assignTemplateReq = {
    /** 模板ID（null表示取消设置） */
    templateId: number | null;
  };

  type attachmentBatchDeleteReq = {
    /** 素材ID列表 */
    ids: number[];
  };

  type attachmentBatchDeleteResp = {
    code: number;
    message: string;
    success: boolean;
    data: { ids: number[] };
    timestamp: string;
  };

  type attachmentDeleteResp = {
    code: number;
    message: string;
    success: boolean;
    data: { id: number };
    timestamp: string;
  };

  type attachmentDetailResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysAttachment;
    timestamp: string;
  };

  type attachmentFolderDeleteResp = {
    code: number;
    message: string;
    success: boolean;
    data: { id: number };
    timestamp: string;
  };

  type attachmentFolderDetailResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysAttachmentFolder;
    timestamp: string;
  };

  type attachmentFolderListQuery = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（名称） */
    keyword?: string;
    /** 分组类型 */
    kind?: "all" | "image" | "audio" | "video" | "other";
    /** 状态 */
    status?: "0" | "1";
    /** 父分组ID过滤 */
    parentId?: number;
    sortBy?: "sort_order" | "createdAt" | "updatedAt";
    sortOrder?: "asc" | "desc";
  };

  type attachmentFolderListResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysAttachmentFolder[];
    timestamp: string;
    pagination: paginationResponse;
  };

  type attachmentFolderTreeResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysAttachmentFolder[];
    timestamp: string;
  };

  type attachmentListQuery = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（名称/原始文件名） */
    keyword?: string;
    /** 素材类型 */
    kind?: "image" | "audio" | "video" | "other";
    /** 分组ID过滤 */
    folderId?: number;
    /** MIME 类型过滤 */
    mimeType?: string;
    /** 存储类型过滤 */
    storage?: string;
    /** 状态 */
    status?: "0" | "1";
    sortBy?: "createdAt" | "size" | "updatedAt";
    sortOrder?: "asc" | "desc";
  };

  type attachmentListResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysAttachment[];
    timestamp: string;
    pagination: paginationResponse;
  };

  type batchGetSystemOptionByQueryParams = {
    /** 可以传多个 key，如 ?key=a&key=b */
    key?: systemOptionKey | systemOptionKey[];
  };

  type batchGetSystemOptionReq = systemOptionKey[];

  type batchGetSystemOptionResp = {
    success?: boolean;
    code?: number;
    message?: string;
    timestamp?: string;
    data?: { results?: { key?: systemOptionKey; value?: string | null }[] };
  };

  type batchSetSystemOptionReq = systemOptionItem[];

  type batchSetSystemOptionResp = {
    success?: boolean;
    code?: number;
    message?: string;
    timestamp?: string;
    data?: {
      updatedCount?: number;
      results?: {
        key?: systemOptionKey;
        value?: string;
        success?: boolean;
        code?: number;
        message?: string;
      }[];
    };
  };

  type categoryDeleteResp = {
    code: number;
    message: string;
    success: boolean;
    data: { id: number };
    timestamp: string;
  };

  type categoryDetailResp = {
    code: number;
    message: string;
    success: boolean;
    data: portalCategory;
    timestamp: string;
  };

  type categoryListQuery = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（名称、描述） */
    keyword?: string;
    /** 状态 */
    status?: "0" | "1";
    /** 父级分类ID */
    parentId?: number;
    sortBy?: "sort_order" | "createdAt" | "updatedAt";
    sortOrder?: "asc" | "desc";
  };

  type categoryListResp = {
    code: number;
    message: string;
    success: boolean;
    data: portalCategory[];
    timestamp: string;
    pagination: paginationResponse;
  };

  type cleanupTokensReq = {
    /** 定时任务令牌，用于接口鉴权 */
    cron_token: string;
    /** 保留天数，默认30天 */
    days_to_keep?: number;
  };

  type cleanupTokensResp = {
    success?: boolean;
    code?: number;
    message?: string;
    timestamp?: string;
    data?: { deletedCount?: number; revokedCount?: number; message?: string };
  };

  type createArticleReq = {
    /** 标题 */
    title: string;
    /** URL标识 */
    slug?: string;
    /** 摘要 */
    summary?: string;
    /** 正文内容 */
    content: string;
    /** 封面图URL */
    coverImage?: string;
    /** 状态（0-草稿，1-已发布） */
    status?: "0" | "1";
    /** 是否置顶 */
    isPinned?: boolean;
    /** 发布时间 */
    publishTime?: string;
    /** 标签 */
    tags?: string[];
    attributes?: dynamicAttributes;
    /** 模板ID */
    templateId?: number;
    /** 分类ID列表 */
    categoryIds?: number[];
  };

  type createAttachmentFolderReq = {
    /** 分组名称 */
    name: string;
    /** 父分组ID */
    parentId?: number;
    /** 分组类型 */
    kind?: "all" | "image" | "audio" | "video" | "other";
    /** 状态 */
    status?: "0" | "1";
    /** 排序序号 */
    sort_order?: number;
    /** 备注 */
    remark?: string;
  };

  type createCloudAttachmentReq = {
    /** 存储类型 */
    storage: "qiniu" | "aliyunOss";
    /** 对象存储Key */
    objectKey: string;
    /** 可访问URL */
    url?: string;
    folderId?: number | null;
    /** 素材类型 */
    kind?: "image" | "audio" | "video" | "other";
    name?: string | null;
    /** 原始文件名 */
    originalName: string;
    /** MIME 类型 */
    mimeType: string;
    /** 文件大小（字节） */
    size: number;
    hash?: string | null;
    /** 扩展信息 */
    metadata?: any;
  };

  type createDeptReq = {
    /** 部门名称 */
    name: string;
    /** 上级部门ID */
    parentId?: number;
    /** 状态 */
    status?: "0" | "1";
    /** 排序序号 */
    sort_order?: number;
    /** 部门描述 */
    description?: string;
    /** 负责人ID */
    leaderId?: number;
  };

  type createPageReq = {
    /** 页面标题 */
    title: string;
    /** 页面路径（唯一） */
    path: string;
    /** 页面内容 */
    content: string;
    /** 状态 */
    status?: "0" | "1";
    /** 发布时间 */
    publishTime?: string;
    attributes?: pageDynamicAttributes;
    /** 模板ID */
    templateId?: number;
  };

  type createTemplateReq = {
    /** 模板名称 */
    name: string;
    /** 模板描述 */
    description?: string;
    /** 模板类型 */
    type: "article" | "page";
    schema?: templateSchemaFields;
    /** 模板配置（JSON） */
    config?: any;
    /** 状态 */
    status?: "0" | "1";
    /** 是否系统默认 */
    isSystemDefault?: boolean;
  };

  type createUserReq = {
    /** 用户名 */
    username?: string;
    /** 邮箱 */
    email?: string;
    /** 用户密码 */
    password: string;
    /** 手机号 */
    phone: string;
    /** 真实姓名 */
    realName?: string;
    /** 昵称 */
    nickname?: string;
    /** 头像URL */
    avatar?: string;
    /** 性别（0-未知，1-男，2-女） */
    gender?: "0" | "1" | "2";
    birthDate?: string | "";
    /** 状态（0-禁用，1-启用，2-锁定） */
    status?: "0" | "1" | "2";
    /** 部门ID列表 */
    deptIds?: number[];
    /** 角色ID列表 */
    roleIds?: number[];
  };

  type currentUser = {
    /** 用户ID */
    id: number;
    /** 用户名 */
    username: string;
    /** 邮箱 */
    email?: string;
    /** 手机号 */
    phone?: string;
    /** 真实姓名 */
    realName: string;
    /** 头像URL */
    avatar?: string;
    /** 性别（0-未知，1-男，2-女） */
    gender: "0" | "1" | "2";
    /** 性别名称 */
    genderName: string;
    /** 出生日期 */
    birthDate?: string;
    /** 状态（0-禁用，1-启用，2-锁定） */
    status: "0" | "1" | "2";
    /** 状态名称 */
    statusName: string;
    /** 最后登录时间 */
    lastLoginTime?: string;
    /** 最后登录IP */
    lastLoginIp?: string;
    /** 登录次数 */
    loginCount: number;
    /** 创建时间 */
    createdAt: string;
    /** 更新时间 */
    updatedAt: string;
    /** 已授权菜单路径列表 */
    accessPath?: string[];
  };

  type currentUserResp = {
    code: number;
    message: string;
    success: boolean;
    data: currentUser;
    timestamp: string;
  };

  type deleteArticleParams = {
    /** 文章ID */
    id: number;
  };

  type deleteArticleTemplateParams = {
    /** 模板ID */
    id: number;
  };

  type deleteAttachmentFolderParams = {
    /** 分组ID */
    id: number;
  };

  type deleteAttachmentParams = {
    /** 素材ID */
    id: number;
  };

  type deleteCategoryParams = {
    /** 分类ID */
    id: number;
  };

  type deleteDeptParams = {
    /** 部门ID */
    id: number;
  };

  type deleteDictDataParams = {
    id: number;
  };

  type deleteDictTypeParams = {
    id: number;
  };

  type deleteMenuParams = {
    /** 菜单ID */
    id: string;
  };

  type deletePageParams = {
    /** 页面ID */
    id: number;
  };

  type deletePageTemplateParams = {
    /** 模板ID */
    id: number;
  };

  type deletePostParams = {
    /** 岗位ID */
    id: string;
  };

  type deleteRoleParams = {
    /** 角色ID */
    id: number;
  };

  type deleteUserParams = {
    /** 用户ID */
    id: number;
  };

  type deptDeleteResp = {
    code: number;
    message: string;
    success: boolean;
    data: { id: number };
    timestamp: string;
  };

  type deptDetailResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysDept;
    timestamp: string;
  };

  type deptListQuery = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（名称、描述） */
    keyword?: string;
    /** 部门状态 */
    status?: "0" | "1";
    /** 上级部门ID过滤 */
    parentId?: number;
    /** 排序字段 */
    sortBy?: "sort_order" | "createdAt" | "updatedAt";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type deptListResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysDept[];
    timestamp: string;
    pagination: paginationResponse;
  };

  type deptTreeList = deptTreeNode[];

  type deptTreeNode = {
    /** 部门ID */
    id: number;
    /** 部门名称 */
    name: string;
    /** 上级部门ID */
    parentId?: number;
    /** 上级部门名称 */
    parentName?: string;
    /** 状态（0-禁用，1-启用） */
    status: "0" | "1";
    /** 排序序号 */
    sort_order: number;
    /** 部门描述 */
    description?: string;
    /** 负责人ID */
    leaderId?: number;
    /** 负责人名称 */
    leaderName?: string;
    /** 创建人Id */
    creatorId?: number;
    /** 创建人名称 */
    creatorName?: string;
    /** 创建时间 */
    createdAt: string;
    /** 更新人Id */
    updaterId?: number;
    /** 更新人名称 */
    updaterName?: string;
    /** 更新时间 */
    updatedAt: string;
    children: deptTreeNode[] | null;
  };

  type deptTreeResp = {
    code: number;
    message: string;
    success: boolean;
    data: deptTreeList;
    timestamp: string;
  };

  type dictDataDeleteResp = {
    code: number;
    message: string;
    success: boolean;
    data: { id: number };
    timestamp: string;
  };

  type dictDataDetailResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysDictData;
    timestamp: string;
  };

  type dictDataListQuery = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    typeId?: number;
    type?: string;
    keyword?: string;
    status?: 0 | 1;
    sortBy?: "sort_order" | "createdAt" | "updatedAt";
    sortOrder?: "asc" | "desc";
  };

  type dictDataListResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysDictData[];
    timestamp: string;
    pagination: paginationResponse;
  };

  type dictDataMapResp = {
    code: number;
    message: string;
    success: boolean;
    data: Record<string, any>;
    timestamp: string;
  };

  type dictTypeDeleteResp = {
    code: number;
    message: string;
    success: boolean;
    data: { id: number };
    timestamp: string;
  };

  type dictTypeDetailResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysDictType;
    timestamp: string;
  };

  type dictTypeListQuery = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    keyword?: string;
    status?: 0 | 1;
    sortBy?: "sort_order" | "createdAt" | "updatedAt";
    sortOrder?: "asc" | "desc";
  };

  type dictTypeListResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysDictType[];
    timestamp: string;
    pagination: paginationResponse;
  };

  type dynamicAttributes = true;

  type getArticleDetailParams = {
    /** 文章ID */
    id: number;
  };

  type getArticleListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（标题、摘要、内容） */
    keyword?: string;
    /** 状态 */
    status?: "0" | "1";
    /** 分类ID过滤 */
    categoryId?: number;
    /** 开始时间 */
    startTime?: string;
    /** 结束时间 */
    endTime?: string;
    /** 排序字段 */
    sortBy?: "createdAt" | "updatedAt" | "publishTime";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type getArticleTemplateListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（名称） */
    keyword?: string;
    /** 模板类型 */
    type?: "article" | "page";
    /** 状态 */
    status?: "0" | "1";
    sortBy?: "createdAt" | "updatedAt";
    sortOrder?: "asc" | "desc";
  };

  type getArticleTemplateSchemaParams = {
    /** 模板ID */
    id: number;
  };

  type getAttachmentDetailParams = {
    /** 素材ID */
    id: number;
  };

  type getAttachmentFolderDetailParams = {
    /** 分组ID */
    id: number;
  };

  type getAttachmentFolderListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（名称） */
    keyword?: string;
    /** 分组类型 */
    kind?: "all" | "image" | "audio" | "video" | "other";
    /** 状态 */
    status?: "0" | "1";
    /** 父分组ID过滤 */
    parentId?: number;
    sortBy?: "sort_order" | "createdAt" | "updatedAt";
    sortOrder?: "asc" | "desc";
  };

  type getAttachmentListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（名称/原始文件名） */
    keyword?: string;
    /** 素材类型 */
    kind?: "image" | "audio" | "video" | "other";
    /** 分组ID过滤 */
    folderId?: number;
    /** MIME 类型过滤 */
    mimeType?: string;
    /** 存储类型过滤 */
    storage?: string;
    /** 状态 */
    status?: "0" | "1";
    sortBy?: "createdAt" | "size" | "updatedAt";
    sortOrder?: "asc" | "desc";
  };

  type getCategoryDetailParams = {
    /** 分类ID */
    id: number;
  };

  type getCategoryListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（名称、描述） */
    keyword?: string;
    /** 状态 */
    status?: "0" | "1";
    /** 父级分类ID */
    parentId?: number;
    sortBy?: "sort_order" | "createdAt" | "updatedAt";
    sortOrder?: "asc" | "desc";
  };

  type getDeptDetailParams = {
    /** 部门ID */
    id: number;
  };

  type getDeptListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（名称、描述） */
    keyword?: string;
    /** 部门状态 */
    status?: "0" | "1";
    /** 上级部门ID过滤 */
    parentId?: number;
    /** 排序字段 */
    sortBy?: "sort_order" | "createdAt" | "updatedAt";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type getDictDataDetailParams = {
    id: number;
  };

  type getDictDataListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    typeId?: number;
    type?: string;
    keyword?: string;
    status?: 0 | 1;
    sortBy?: "sort_order" | "createdAt" | "updatedAt";
    sortOrder?: "asc" | "desc";
  };

  type getDictTypeDetailParams = {
    id: number;
  };

  type getDictTypeListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    keyword?: string;
    status?: 0 | 1;
    sortBy?: "sort_order" | "createdAt" | "updatedAt";
    sortOrder?: "asc" | "desc";
  };

  type getMenuDetailParams = {
    /** 菜单ID */
    id: string;
  };

  type getMenuListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（名称、路径、组件、权限） */
    keyword?: string;
    /** 菜单状态 */
    status?: "0" | "1";
    /** 菜单类型 */
    type?: 0 | 1 | 2;
    /** 父级菜单ID过滤 */
    parentId?: number;
    /** 排序字段 */
    sortBy?: "sort_order" | "createdAt" | "updatedAt";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type getPageDetailParams = {
    /** 页面ID */
    id: number;
  };

  type getPageListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（标题、路径） */
    keyword?: string;
    /** 状态 */
    status?: "0" | "1";
    sortBy?: "createdAt" | "updatedAt" | "publishTime";
    sortOrder?: "asc" | "desc";
  };

  type getPageTemplateListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（名称） */
    keyword?: string;
    /** 模板类型 */
    type?: "article" | "page";
    /** 状态 */
    status?: "0" | "1";
    sortBy?: "createdAt" | "updatedAt";
    sortOrder?: "asc" | "desc";
  };

  type getPageTemplateSchemaParams = {
    /** 模板ID */
    id: number;
  };

  type getPostDetailParams = {
    /** 岗位ID */
    id: string;
  };

  type getPostListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（名称、描述） */
    keyword?: string;
    /** 岗位状态 */
    status?: "0" | "1";
    /** 排序字段 */
    sortBy?: "sort_order" | "createdAt" | "updatedAt";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type getQiniuUploadTokenParams = {
    /** 可选：指定对象键（bucket:key），默认仅 bucket */
    scopeKey?: string;
    /** 凭证有效期（秒），默认配置值 */
    expiresIn?: number;
  };

  type getRoleDetailParams = {
    /** 角色ID */
    id: number;
  };

  type getRoleListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（角色名称、描述） */
    keyword?: string;
    /** 角色状态（0-禁用，1-启用） */
    status?: "0" | "1";
    /** 排序字段 */
    sortBy?: "createdAt" | "updatedAt";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type getStorageConfigResp = {
    success?: boolean;
    code?: number;
    message?: string;
    timestamp?: string;
    data?: storageConfigSchema;
  };

  type getSystemOptionParams = {
    key: systemOptionKey;
  };

  type getSystemOptionResp = {
    success?: boolean;
    code?: number;
    message?: string;
    timestamp?: string;
    data?: string | null;
  };

  type getUserDetailParams = {
    /** 用户ID */
    id: number;
  };

  type getUserListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（用户名、邮箱、真实姓名、昵称） */
    keyword?: string;
    /** 用户状态（0-禁用，1-启用，2-锁定） */
    status?: "0" | "1" | "2";
    /** 开始时间 */
    startTime?: string;
    /** 结束时间 */
    endTime?: string;
    /** 排序字段 */
    sortBy?: "createdAt" | "updatedAt" | "lastLoginTime" | "loginCount";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type loginData = {
    /** 访问令牌 */
    token: string;
    /** 刷新令牌 */
    refreshToken?: string;
    /** 访问令牌过期时间（秒） */
    expiresIn: number;
    /** 刷新令牌过期时间（秒） */
    refreshTokenExpiresIn?: number;
    /** 访问令牌过期时间戳（秒） */
    expiresAt?: number;
    /** 刷新令牌过期时间戳（秒） */
    refreshTokenExpiresAt?: number;
  };

  type loginReq = {
    /** 用户名或邮箱 */
    username: string;
    /** 密码 */
    password: string;
    /** 记住我 */
    rememberMe?: boolean;
  };

  type loginResp = {
    code: number;
    message: string;
    success: boolean;
    data: loginData;
    timestamp: string;
  };

  type menuDeleteResp = {
    code: number;
    message: string;
    success: boolean;
    data: { id: number };
    timestamp: string;
  };

  type menuDetailResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysMenu;
    timestamp: string;
  };

  type menuListQuery = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（名称、路径、组件、权限） */
    keyword?: string;
    /** 菜单状态 */
    status?: "0" | "1";
    /** 菜单类型 */
    type?: 0 | 1 | 2;
    /** 父级菜单ID过滤 */
    parentId?: number;
    /** 排序字段 */
    sortBy?: "sort_order" | "createdAt" | "updatedAt";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type menuListResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysMenu[];
    timestamp: string;
    pagination: paginationResponse;
  };

  type menuPaths = Record<string, any>;

  type menuPathsResp = {
    code: number;
    message: string;
    success: boolean;
    data: string[];
    timestamp: string;
  };

  type menuTreeList = menuTreeNode[];

  type menuTreeNode = {
    /** 菜单ID */
    id: number;
    /** 菜单名称 */
    name: string;
    /** 类型（0:目录,1:菜单,2:按钮） */
    type: 0 | 1 | 2;
    /** 路由路径/URL */
    path?: string;
    /** 图标名 */
    icon?: string;
    /** 前端组件路径 */
    component?: string;
    /** 父级菜单ID */
    parentId?: number;
    /** 父级菜单名称 */
    parentName?: string;
    /** 状态（0-禁用，1-启用） */
    status: "0" | "1";
    /** 排序序号 */
    sort_order: number;
    /** 是否在菜单中隐藏 */
    hideInMenu: boolean;
    /** 是否外链 */
    isExternalLink: boolean;
    /** 权限标识 */
    perm?: string;
    /** 是否缓存页面 */
    keepAlive: boolean;
    /** 创建人Id */
    creatorId?: number;
    /** 创建人名称 */
    creatorName?: string;
    /** 创建时间 */
    createdAt: string;
    /** 更新人Id */
    updaterId?: number;
    /** 更新人名称 */
    updaterName?: string;
    /** 更新时间 */
    updatedAt: string;
    children: menuTreeNode[] | null;
  };

  type menuTreeResp = {
    code: number;
    message: string;
    success: boolean;
    data: menuTreeList;
    timestamp: string;
  };

  type pageDeleteResp = {
    code: number;
    message: string;
    success: boolean;
    data: { id: number };
    timestamp: string;
  };

  type pageDetailResp = {
    code: number;
    message: string;
    success: boolean;
    data: portalPage;
    timestamp: string;
  };

  type pageDynamicAttributes = true;

  type pageListQuery = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（标题、路径） */
    keyword?: string;
    /** 状态 */
    status?: "0" | "1";
    sortBy?: "createdAt" | "updatedAt" | "publishTime";
    sortOrder?: "asc" | "desc";
  };

  type pageListResp = {
    code: number;
    message: string;
    success: boolean;
    data: portalPage[];
    timestamp: string;
    pagination: paginationResponse;
  };

  type paginationResponse = {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };

  type portalArticle = {
    /** 文章ID */
    id: number;
    /** 标题 */
    title: string;
    /** URL标识 */
    slug?: string;
    /** 摘要 */
    summary?: string;
    /** 正文内容 */
    content: string;
    /** 封面图URL */
    coverImage?: string;
    /** 状态（0-草稿，1-已发布） */
    status: "0" | "1";
    /** 是否置顶 */
    isPinned?: boolean;
    /** 发布时间 */
    publishTime?: string;
    /** 标签 */
    tags?: string[];
    attributes?: dynamicAttributes;
    /** 模板ID */
    templateId?: number;
    /** 模板名称 */
    templateName?: string;
    templateSchema?: templateSchemaFields;
    /** 所属分类ID列表 */
    categoryIds?: number[];
    /** 创建人Id */
    creatorId?: number;
    /** 创建人名称 */
    creatorName?: string;
    /** 创建时间 */
    createdAt: string;
    /** 更新人Id */
    updaterId?: number;
    /** 更新人名称 */
    updaterName?: string;
    /** 更新时间 */
    updatedAt: string;
  };

  type portalCategory = {
    /** 分类ID */
    id: number;
    /** 分类名称 */
    name: string;
    /** URL标识 */
    slug?: string;
    /** 父级分类ID */
    parentId?: number;
    /** 父级分类名称 */
    parentName?: string;
    /** 状态（0-禁用，1-启用） */
    status: "0" | "1";
    /** 排序序号 */
    sort_order: number;
    /** 分类描述 */
    description?: string;
    /** 创建人Id */
    creatorId?: number;
    /** 创建人名称 */
    creatorName?: string;
    /** 创建时间 */
    createdAt: string;
    /** 更新人Id */
    updaterId?: number;
    /** 更新人名称 */
    updaterName?: string;
    /** 更新时间 */
    updatedAt: string;
  };

  type portalPage = {
    /** 页面ID */
    id: number;
    /** 页面标题 */
    title: string;
    /** 页面路径（唯一） */
    path: string;
    /** 页面内容 */
    content: string;
    /** 状态（0-禁用，1-启用） */
    status: "0" | "1";
    /** 发布时间 */
    publishTime?: string;
    attributes?: pageDynamicAttributes;
    /** 模板ID */
    templateId?: number;
    /** 模板名称 */
    templateName?: string;
    /** 创建人Id */
    creatorId?: number;
    /** 创建人名称 */
    creatorName?: string;
    /** 创建时间 */
    createdAt: string;
    /** 更新人Id */
    updaterId?: number;
    /** 更新人名称 */
    updaterName?: string;
    /** 更新时间 */
    updatedAt: string;
  };

  type portalTemplate = {
    /** 模板ID */
    id: number;
    /** 模板名称 */
    name: string;
    /** 模板描述 */
    description?: string;
    /** 模板类型 */
    type: "article" | "page";
    schema?: templateSchemaFields;
    /** 模板配置（JSON） */
    config?: any;
    /** 状态（0-禁用，1-启用） */
    status: "0" | "1";
    /** 是否系统默认 */
    isSystemDefault?: boolean;
    /** 创建人Id */
    creatorId?: number;
    /** 创建人名称 */
    creatorName?: string;
    /** 创建时间 */
    createdAt: string;
    /** 更新人Id */
    updaterId?: number;
    /** 更新人名称 */
    updaterName?: string;
    /** 更新时间 */
    updatedAt: string;
  };

  type postDeleteResp = {
    code: number;
    message: string;
    success: boolean;
    data: { id: number };
    timestamp: string;
  };

  type postDetailResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysPost;
    timestamp: string;
  };

  type postListQuery = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（名称、描述） */
    keyword?: string;
    /** 岗位状态 */
    status?: "0" | "1";
    /** 排序字段 */
    sortBy?: "sort_order" | "createdAt" | "updatedAt";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type postListResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysPost[];
    timestamp: string;
    pagination: paginationResponse;
  };

  type publishArticleParams = {
    /** 文章ID */
    id: number;
  };

  type qiniuConfigSchema = {
    provider?: "qiniu";
    accessKey?: string;
    secretKey?: string;
    bucket?: string;
    region?: qiniuRegion;
    domain?: string;
    useHttps?: boolean;
    useCdnDomains?: boolean;
    tokenExpires?: number;
    callbackUrl?: string;
    uploadHost?: string;
  };

  type qiniuRegion = "z0" | "z1" | "z2" | "na0" | "as0";

  type refreshTokenReq = {
    /** 刷新令牌 */
    refreshToken: string;
  };

  type refreshTokenResp = {
    code: number;
    message: string;
    success: boolean;
    data: loginData;
    timestamp: string;
  };

  type roleDeleteResp = {
    code: number;
    message: string;
    success: boolean;
    data: { id: number };
    timestamp: string;
  };

  type roleDetailResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysRole;
    timestamp: string;
  };

  type roleListQuery = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（角色名称、描述） */
    keyword?: string;
    /** 角色状态（0-禁用，1-启用） */
    status?: "0" | "1";
    /** 排序字段 */
    sortBy?: "createdAt" | "updatedAt";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type roleListResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysRole[];
    timestamp: string;
    pagination: paginationResponse;
  };

  type saveCategoryReq = {
    /** 分类名称 */
    name: string;
    /** URL标识 */
    slug?: string;
    /** 父级分类ID */
    parentId?: number;
    /** 状态 */
    status?: "0" | "1";
    /** 排序序号 */
    sort_order?: number;
    /** 分类描述 */
    description?: string;
  };

  type saveDictDataReq = {
    typeId: number;
    label: string;
    value: string;
    status?: 0 | 1;
    sort_order?: number;
    tag?: string;
    remark?: string;
    isDefault?: boolean;
  };

  type saveDictTypeReq = {
    name: string;
    type: string;
    status?: 0 | 1;
    sort_order?: number;
    remark?: string;
  };

  type saveMenuReq = {
    /** 菜单名称 */
    name: string;
    /** 菜单类型 */
    type?: 0 | 1 | 2;
    /** 父级菜单ID */
    parentId?: number;
    /** 路由路径/URL */
    path?: string;
    /** 图标名 */
    icon?: string;
    /** 组件路径 */
    component?: string;
    /** 状态 */
    status?: "0" | "1";
    /** 排序序号 */
    sort_order?: number;
    /** 隐藏菜单 */
    hideInMenu?: boolean;
    /** 是否外链 */
    isExternalLink?: boolean;
    /** 权限标识 */
    perm?: string;
    /** 是否缓存 */
    keepAlive?: boolean;
  };

  type savePostReq = {
    /** 岗位名称 */
    name: string;
    /** 状态 */
    status?: "0" | "1";
    /** 排序序号 */
    sort_order?: number;
    /** 岗位描述 */
    description?: string;
  };

  type saveRoleReq = {
    /** 角色名称 */
    name: string;
    /** 角色描述 */
    description?: string;
    /** 状态（0-禁用，1-启用） */
    status?: "0" | "1";
    /** 菜单ID列表 */
    menuIds?: number[];
  };

  type setSystemOptionParams = {
    key: systemOptionKey;
  };

  type setSystemOptionReq = {
    /** 参数字符串 */
    value: string;
  };

  type storageConfigExportPayload = {
    format: string;
    version: number;
    exportedAt: string;
    provider: storageProvider;
    qiniu?: qiniuConfigSchema;
    aliyunOss?: aliyunOssConfigSchema;
  };

  type storageConfigExportResp = {
    success?: boolean;
    code?: number;
    message?: string;
    timestamp?: string;
    data?: storageConfigExportPayload;
  };

  type storageConfigImportReq = {
    provider: storageProvider;
    qiniu?: qiniuConfigSchema;
    aliyunOss?: aliyunOssConfigSchema;
    format?: string;
    version?: number;
    exportedAt?: string;
  };

  type storageConfigImportResp = {
    success?: boolean;
    code?: number;
    message?: string;
    timestamp?: string;
    data?: { provider: storageProvider };
  };

  type storageConfigSchema = {
    provider: storageProvider;
    qiniu: qiniuConfigSchema;
    aliyunOss: aliyunOssConfigSchema;
  };

  type storageProvider = "disabled" | "qiniu" | "aliyunOss";

  type sysAttachment = {
    /** 素材ID */
    id: number;
    /** 分组ID */
    folderId?: number;
    /** 分组名称 */
    folderName?: string;
    /** 素材类型 */
    kind: "image" | "audio" | "video" | "other";
    /** 素材名称 */
    name?: string;
    /** 原始文件名 */
    originalName: string;
    /** 存储文件名 */
    filename: string;
    /** 扩展名 */
    ext?: string;
    /** MIME 类型 */
    mimeType: string;
    /** 文件大小（字节） */
    size: number;
    /** 存储类型 */
    storage: string;
    /** 本地路径 */
    path?: string;
    /** 可访问URL */
    url?: string;
    /** 对象存储Key */
    objectKey?: string;
    /** 内容哈希 */
    hash?: string;
    /** 图片宽度 */
    width?: number;
    /** 图片高度 */
    height?: number;
    /** 音视频时长（秒） */
    duration?: number;
    /** 扩展信息 */
    metadata?: any;
    /** 状态（0-禁用，1-启用） */
    status: "0" | "1";
    /** 创建人Id */
    creatorId?: number;
    /** 创建人名称 */
    creatorName?: string;
    /** 创建时间 */
    createdAt: string;
    /** 更新人Id */
    updaterId?: number;
    /** 更新人名称 */
    updaterName?: string;
    /** 更新时间 */
    updatedAt: string;
  };

  type sysAttachmentFolder = {
    /** 分组ID */
    id: number;
    /** 分组名称 */
    name: string;
    /** 父分组ID */
    parentId?: number;
    /** 分组类型 */
    kind: "all" | "image" | "audio" | "video" | "other";
    /** 状态（0-禁用，1-启用） */
    status: "0" | "1";
    /** 排序序号 */
    sort_order: number;
    /** 备注 */
    remark?: string;
    /** 创建人Id */
    creatorId?: number;
    /** 创建人名称 */
    creatorName?: string;
    /** 创建时间 */
    createdAt: string;
    /** 更新人Id */
    updaterId?: number;
    /** 更新人名称 */
    updaterName?: string;
    /** 更新时间 */
    updatedAt: string;
    children?: sysAttachmentFolder[];
  };

  type sysDept = {
    /** 部门ID */
    id: number;
    /** 部门名称 */
    name: string;
    /** 上级部门ID */
    parentId?: number;
    /** 上级部门名称 */
    parentName?: string;
    /** 状态（0-禁用，1-启用） */
    status: "0" | "1";
    /** 排序序号 */
    sort_order: number;
    /** 部门描述 */
    description?: string;
    /** 负责人ID */
    leaderId?: number;
    /** 负责人名称 */
    leaderName?: string;
    /** 创建人Id */
    creatorId?: number;
    /** 创建人名称 */
    creatorName?: string;
    /** 创建时间 */
    createdAt: string;
    /** 更新人Id */
    updaterId?: number;
    /** 更新人名称 */
    updaterName?: string;
    /** 更新时间 */
    updatedAt: string;
  };

  type sysDictData = {
    id: number;
    typeId: number;
    type: string;
    label: string;
    value: string;
    status: 0 | 1;
    sort_order: number;
    tag?: string;
    remark?: string;
    isDefault: boolean;
    creatorId?: number;
    creatorName?: string;
    createdAt: string;
    updaterId?: number;
    updaterName?: string;
    updatedAt: string;
  };

  type sysDictType = {
    id: number;
    name: string;
    type: string;
    status: 0 | 1;
    sort_order: number;
    remark?: string;
    creatorId?: number;
    creatorName?: string;
    createdAt: string;
    updaterId?: number;
    updaterName?: string;
    updatedAt: string;
  };

  type sysMenu = {
    /** 菜单ID */
    id: number;
    /** 菜单名称 */
    name: string;
    /** 类型（0:目录,1:菜单,2:按钮） */
    type: 0 | 1 | 2;
    /** 路由路径/URL */
    path?: string;
    /** 图标名 */
    icon?: string;
    /** 前端组件路径 */
    component?: string;
    /** 父级菜单ID */
    parentId?: number;
    /** 父级菜单名称 */
    parentName?: string;
    /** 状态（0-禁用，1-启用） */
    status: "0" | "1";
    /** 排序序号 */
    sort_order: number;
    /** 是否在菜单中隐藏 */
    hideInMenu: boolean;
    /** 是否外链 */
    isExternalLink: boolean;
    /** 权限标识 */
    perm?: string;
    /** 是否缓存页面 */
    keepAlive: boolean;
    /** 创建人Id */
    creatorId?: number;
    /** 创建人名称 */
    creatorName?: string;
    /** 创建时间 */
    createdAt: string;
    /** 更新人Id */
    updaterId?: number;
    /** 更新人名称 */
    updaterName?: string;
    /** 更新时间 */
    updatedAt: string;
  };

  type sysPost = {
    /** 岗位ID */
    id: number;
    /** 岗位名称 */
    name: string;
    /** 状态（0-禁用，1-启用） */
    status: "0" | "1";
    /** 排序序号 */
    sort_order: number;
    /** 岗位描述 */
    description?: string;
    /** 创建人Id */
    creatorId?: number;
    /** 创建人名称 */
    creatorName?: string;
    /** 创建时间 */
    createdAt: string;
    /** 更新人Id */
    updaterId?: number;
    /** 更新人名称 */
    updaterName?: string;
    /** 更新时间 */
    updatedAt: string;
  };

  type sysRole = {
    /** 角色ID */
    id: number;
    /** 角色名称 */
    name: string;
    /** 角色描述 */
    description?: string;
    /** 状态（0-禁用，1-启用） */
    status: "0" | "1";
    /** 是否系统默认角色 */
    isSystemDefault?: boolean;
    /** 创建人Id */
    creatorId?: number;
    /** 创建人名称 */
    creatorName?: string;
    /** 创建时间 */
    createdAt: string;
    /** 更新人Id */
    updaterId?: number;
    /** 更新人名称 */
    updaterName?: string;
    /** 更新时间 */
    updatedAt: string;
    /** 菜单ID列表 */
    menuIds?: number[];
  };

  type systemOptionItem = {
    key: systemOptionKey;
    /** 参数字符串（可为纯文本或JSON字符串） */
    value: string;
  };

  type systemOptionKey = string;

  type sysUser = {
    /** 用户ID */
    id: number;
    /** 用户名 */
    username?: string;
    /** 邮箱 */
    email?: string;
    /** 手机号 */
    phone: string;
    /** 真实姓名 */
    realName?: string;
    /** 昵称 */
    nickname?: string;
    /** 头像URL */
    avatar?: string;
    /** 性别（0-未知，1-男，2-女） */
    gender: "0" | "1" | "2";
    /** 性别名称 */
    genderName: string;
    /** 出生日期 */
    birthDate?: string;
    /** 状态（0-禁用，1-启用，2-锁定） */
    status: "0" | "1" | "2";
    /** 状态名称 */
    statusName: string;
    /** 最后登录时间 */
    lastLoginTime?: string;
    /** 最后登录IP */
    lastLoginIp?: string;
    /** 登录次数 */
    loginCount: number;
    /** 创建人Id */
    creatorId: number;
    /** 创建人名称 */
    creatorName?: string;
    /** 创建时间 */
    createdAt: string;
    /** 更新人Id */
    updaterId: number;
    /** 更新人名称 */
    updaterName?: string;
    /** 更新时间 */
    updatedAt: string;
    /** 部门ID列表 */
    deptIds?: number[];
    /** 角色ID列表 */
    roleIds?: number[];
  };

  type templateDeleteResp = {
    code: number;
    message: string;
    success: boolean;
    data: { id: number };
    timestamp: string;
  };

  type templateDetailResp = {
    code: number;
    message: string;
    success: boolean;
    data: portalTemplate;
    timestamp: string;
  };

  type templateField = {
    /** 字段显示名称 */
    label: string;
    /** 组件类型，如 input、radio、select 等 */
    type: string;
    /** 字段标识名称（可选） */
    name?: string;
    /** 是否必填 */
    required?: boolean;
    /** 可选项（适用于 radio/select/checkbox 等） */
    options?: { label: string; value: any }[];
    /** 组件属性 */
    props?: Record<string, any>;
  };

  type templateFieldOption = {
    /** 选项文本 */
    label: string;
    /** 选项值 */
    value: any;
  };

  type templateListQuery = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（名称） */
    keyword?: string;
    /** 模板类型 */
    type?: "article" | "page";
    /** 状态 */
    status?: "0" | "1";
    sortBy?: "createdAt" | "updatedAt";
    sortOrder?: "asc" | "desc";
  };

  type templateListResp = {
    code: number;
    message: string;
    success: boolean;
    data: portalTemplate[];
    timestamp: string;
    pagination: paginationResponse;
  };

  type templateSchemaFields = Record<string, any>;

  type templateSchemaResp = {
    code: number;
    message: string;
    success: boolean;
    data: templateSchemaFields;
    timestamp: string;
  };

  type tokenStatsResp = {
    success?: boolean;
    code?: number;
    message?: string;
    timestamp?: string;
    data?: {
      totalTokens?: number;
      activeTokens?: number;
      expiredTokens?: number;
      revokedTokens?: number;
    };
  };

  type updateArticleParams = {
    /** 文章ID */
    id: number;
  };

  type updateArticleReq = {
    /** 标题 */
    title?: string;
    /** URL标识 */
    slug?: string;
    /** 摘要 */
    summary?: string;
    /** 正文内容 */
    content?: string;
    /** 封面图URL */
    coverImage?: string;
    /** 状态（0-草稿，1-已发布） */
    status?: "0" | "1";
    /** 是否置顶 */
    isPinned?: boolean;
    /** 发布时间 */
    publishTime?: string;
    /** 标签 */
    tags?: string[];
    attributes?: dynamicAttributes;
    /** 模板ID */
    templateId?: number;
    /** 分类ID列表 */
    categoryIds?: number[];
  };

  type updateArticleTemplateParams = {
    /** 模板ID */
    id: number;
  };

  type updateArticleTemplateSchemaParams = {
    /** 模板ID */
    id: number;
  };

  type updateAttachmentFolderParams = {
    /** 分组ID */
    id: number;
  };

  type updateAttachmentFolderReq = {
    /** 分组名称 */
    name?: string;
    /** 父分组ID */
    parentId?: number;
    /** 分组类型 */
    kind?: "all" | "image" | "audio" | "video" | "other";
    /** 状态 */
    status?: "0" | "1";
    /** 排序序号 */
    sort_order?: number;
    /** 备注 */
    remark?: string;
  };

  type updateAttachmentParams = {
    /** 素材ID */
    id: number;
  };

  type updateAttachmentReq = {
    /** 素材名称 */
    name?: string;
    folderId?: number | null;
    /** 状态 */
    status?: "0" | "1";
    /** 扩展信息 */
    metadata?: any;
  };

  type updateCategoryParams = {
    /** 分类ID */
    id: number;
  };

  type updateCategoryReq = {
    /** 分类名称 */
    name?: string;
    /** URL标识 */
    slug?: string;
    /** 父级分类ID */
    parentId?: number;
    /** 状态 */
    status?: "0" | "1";
    /** 排序序号 */
    sort_order?: number;
    /** 分类描述 */
    description?: string;
  };

  type updateDeptParams = {
    /** 部门ID */
    id: number;
  };

  type updateDeptReq = {
    /** 部门名称 */
    name?: string;
    /** 上级部门ID */
    parentId?: number;
    /** 状态 */
    status?: "0" | "1";
    /** 排序序号 */
    sort_order?: number;
    /** 部门描述 */
    description?: string;
    /** 负责人ID */
    leaderId?: number;
  };

  type updateDictDataParams = {
    id: number;
  };

  type updateDictDataReq = {
    typeId?: number;
    label?: string;
    value?: string;
    status?: 0 | 1;
    sort_order?: number;
    tag?: string;
    remark?: string;
    isDefault?: boolean;
  };

  type updateDictTypeParams = {
    id: number;
  };

  type updateDictTypeReq = {
    name?: string;
    type?: string;
    status?: 0 | 1;
    sort_order?: number;
    remark?: string;
  };

  type updateMenuParams = {
    /** 菜单ID */
    id: string;
  };

  type updateMenuReq = {
    /** 菜单名称 */
    name?: string;
    /** 菜单类型 */
    type?: 0 | 1 | 2;
    /** 父级菜单ID */
    parentId?: number;
    /** 路由路径/URL */
    path?: string;
    /** 图标名 */
    icon?: string;
    /** 组件路径 */
    component?: string;
    /** 状态 */
    status?: "0" | "1";
    /** 排序序号 */
    sort_order?: number;
    /** 隐藏菜单 */
    hideInMenu?: boolean;
    /** 是否外链 */
    isExternalLink?: boolean;
    /** 权限标识 */
    perm?: string;
    /** 是否缓存 */
    keepAlive?: boolean;
  };

  type updatePageParams = {
    /** 页面ID */
    id: number;
  };

  type updatePageReq = {
    /** 页面标题 */
    title?: string;
    /** 页面路径（唯一） */
    path?: string;
    /** 页面内容 */
    content?: string;
    /** 状态 */
    status?: "0" | "1";
    /** 发布时间 */
    publishTime?: string;
    attributes?: pageDynamicAttributes;
    /** 模板ID */
    templateId?: number;
  };

  type updatePageTemplateParams = {
    /** 模板ID */
    id: number;
  };

  type updatePageTemplateSchemaParams = {
    /** 模板ID */
    id: number;
  };

  type updatePostParams = {
    /** 岗位ID */
    id: string;
  };

  type updatePostReq = {
    /** 岗位名称 */
    name?: string;
    /** 状态 */
    status?: "0" | "1";
    /** 排序序号 */
    sort_order?: number;
    /** 岗位描述 */
    description?: string;
  };

  type updateRoleParams = {
    /** 角色ID */
    id: number;
  };

  type updateRoleReq = {
    /** 角色名称 */
    name?: string;
    /** 角色描述 */
    description?: string;
    /** 状态（0-禁用，1-启用） */
    status?: "0" | "1";
    /** 菜单ID列表 */
    menuIds?: number[];
  };

  type updateTemplateReq = {
    /** 模板名称 */
    name?: string;
    /** 模板描述 */
    description?: string;
    /** 模板类型 */
    type?: "article" | "page";
    schema?: templateSchemaFields;
    /** 模板配置（JSON） */
    config?: any;
    /** 状态 */
    status?: "0" | "1";
  };

  type updateTemplateSchemaReq = {
    schema: templateSchemaFields;
  };

  type updateUserParams = {
    /** 用户ID */
    id: number;
  };

  type updateUserReq = {
    /** 用户名 */
    username?: string;
    /** 邮箱 */
    email?: string;
    /** 用户密码 */
    password?: string;
    /** 手机号 */
    phone?: string;
    /** 真实姓名 */
    realName?: string;
    /** 昵称 */
    nickname?: string;
    /** 头像URL */
    avatar?: string;
    /** 性别（0-未知，1-男，2-女） */
    gender?: "0" | "1" | "2";
    birthDate?: string | "";
    /** 状态（0-禁用，1-启用，2-锁定） */
    status?: "0" | "1" | "2";
    /** 部门ID列表 */
    deptIds?: number[];
    /** 角色ID列表 */
    roleIds?: number[];
  };

  type uploadAttachmentsParams = {
    /** 分组ID */
    folderId?: number;
    /** 素材类型 */
    kind?: "image" | "audio" | "video" | "other";
    /** 素材名称（批量上传时忽略） */
    name?: string;
  };

  type uploadAttachmentsResp = {
    code: number;
    message: string;
    success: boolean;
    data: {
      id?: number;
      filename: string;
      originalName: string;
      mimeType: string;
      size: number;
      path: string;
      kind?: "image" | "audio" | "video" | "other";
      url?: string;
    }[];
    timestamp: string;
  };

  type upsertStorageConfigReq = {
    provider: storageProvider;
    qiniu?: qiniuConfigSchema;
    aliyunOss?: aliyunOssConfigSchema;
  };

  type upsertStorageConfigResp = {
    success?: boolean;
    code?: number;
    message?: string;
    timestamp?: string;
    data?: storageConfigSchema;
  };

  type userDeleteResp = {
    code: number;
    message: string;
    success: boolean;
    data: { id: number; deleted: boolean };
    timestamp: string;
  };

  type userDetailResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysUser;
    timestamp: string;
  };

  type userListQuery = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（用户名、邮箱、真实姓名、昵称） */
    keyword?: string;
    /** 用户状态（0-禁用，1-启用，2-锁定） */
    status?: "0" | "1" | "2";
    /** 开始时间 */
    startTime?: string;
    /** 结束时间 */
    endTime?: string;
    /** 排序字段 */
    sortBy?: "createdAt" | "updatedAt" | "lastLoginTime" | "loginCount";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type userListResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysUser[];
    timestamp: string;
    pagination: paginationResponse;
  };
}
