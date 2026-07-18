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

  type apiTokenCreateData = {
    id: number;
    name: string;
    scopes: string[];
    userId: number;
    expiresAt: string | null;
    createdAt: string;
    token: string;
  };

  type apiTokenCreateReq = {
    name: string;
    duration?: apiTokenDuration;
    /** 自定义过期时间(ISO datetime)。与 duration 互斥。 */
    expiresAt?: string;
    /** 授权范围（permission code 列表）。为空/不传 = 创建空 scopes（保守默认，无任何资源授权）。 特殊值：'*' = 完全继承用户角色权限（含 super_admin 旁路）；'__super_admin__' = 显式要求保留 super_admin 旁路；其余 code 必须是 PERMISSION_CODES 中已登记的静态 code 或 manifest 注册的扩展 code，未知 code 将被拒绝（400 INVALID_PARAMETER）。 */
    scopes?: string[];
  };

  type apiTokenCreateResp = {
    code: number;
    message: string;
    success: boolean;
    data: apiTokenCreateData;
    timestamp: string;
  };

  type apiTokenDeleteData = {
    id: number;
  };

  type apiTokenDeleteResp = {
    code: number;
    message: string;
    success: boolean;
    data: apiTokenDeleteData;
    timestamp: string;
  };

  type apiTokenDuration = Record<string, any>;

  type apiTokenListData = {
    list: apiTokenRecord[];
    total: number;
  };

  type apiTokenListResp = {
    code: number;
    message: string;
    success: boolean;
    data: apiTokenListData;
    timestamp: string;
  };

  type apiTokenRecord = {
    id: number;
    name: string;
    /** 授权范围 (Section 2 PAT scopes)。空数组表示无任何权限。 */
    scopes: string[];
    userId: number;
    expiresAt: string | null;
    lastUsedAt: string | null;
    lastUsedIp: string | null;
    createdAt: string;
    updatedAt: string;
  };

  type apiTokenRecordResp = {
    code: number;
    message: string;
    success: boolean;
    data: apiTokenRecord;
    timestamp: string;
  };

  type appGetDeptUsersParams = {
    id: number;
  };

  type appGetDictByTypeParams = {
    type: string;
  };

  type appGetMyLoginLogsParams = {
    page?: number;
    pageSize?: number;
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
    sortBy?: "sortOrder" | "createdAt" | "updatedAt";
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

  type availableScopeGroup = {
    /** 分组名称，如 系统管理 */
    label: string;
    system: "system" | "shop" | "portal" | "special";
    options: availableScopeItem[];
  };

  type availableScopeItem = {
    /** 权限码，如 system:user:list */
    value: string;
    /** 展示用中文标签，如 用户管理-列表 */
    label: string;
    /** 可选的描述/提示文本 */
    description?: string;
  };

  type availableScopesResp = {
    code: number;
    message: string;
    success: boolean;
    data: { groups: availableScopeGroup[] };
    timestamp: string;
  };

  type batchGetSystemOptionByQueryParams = {
    /** 通过数组语法传参：?key[]=a&key[]=b */
    "key[]": systemOptionKey[];
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

  type crmAddDispatchLogParams = {
    id: number;
  };

  type crmAddDispatchReplyParams = {
    id: number;
  };

  type crmAddMemberRemarkParams = {
    id: number;
  };

  type crmAssignHospitalAccountParams = {
    id: number;
  };

  type crmBindWechatOpenidParams = {
    id: number;
    hospital_id: string;
    openid: string;
  };

  type crmContentReq = {
    content: string;
  };

  type crmCreateHospitalAccountParams = {
    id: number;
  };

  type crmCustomerListQuery = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    startTime?: string;
    endTime?: string;
  } & {
    statusId?: number;
  };

  type crmCustomerReq = {
    numberId?: string;
    name: string;
    gender?: number;
    birthday?: string;
    telphone?: string;
    mobile?: string;
    qq?: string;
    wechat?: string;
    provinceId?: number;
    cityId?: number;
    districtId?: number;
    address?: string;
    plastic?: string;
    statusId?: number;
    remark?: string;
    ownerUserId?: number;
  };

  type crmCustomerUpdateReq = {
    numberId?: string;
    name?: string;
    gender?: number;
    birthday?: string;
    telphone?: string;
    mobile?: string;
    qq?: string;
    wechat?: string;
    provinceId?: number;
    cityId?: number;
    districtId?: number;
    address?: string;
    plastic?: string;
    statusId?: number;
    remark?: string;
    ownerUserId?: number;
  };

  type crmDeleteHospitalAccountParams = {
    id: number;
    userId: number;
  };

  type crmDeleteHospitalParams = {
    id: number;
  };

  type crmDispatchCreateReq = {
    hospitalIds: number[];
    reply?: string;
    statusId?: number;
  };

  type crmDispatchCustomerParams = {
    id: number;
  };

  type crmDispatchReplyReq = {
    content?: string;
    receiveQq?: string;
    receiveWechat?: string;
    image?: string;
    statusId?: number;
  };

  type crmDispatchReq = {
    hospitalId?: number;
    statusId?: number;
    image?: string;
    receiveQq?: string;
    receiveWechat?: string;
    finishedAt?: string;
  };

  type crmExportDispatchesParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    startTime?: string;
    endTime?: string;
  };

  type crmGetCustomerParams = {
    id: number;
  };

  type crmGetDispatchParams = {
    id: number;
  };

  type crmGetHospitalParams = {
    id: number;
  };

  type crmGetMemberParams = {
    id: number;
  };

  type crmHospitalAccountAssignReq = {
    userId: number;
    role?: string;
    remark?: string;
  };

  type crmHospitalAccountCreateReq = {
    username: string;
    phone: string;
    realName?: string;
    email?: string;
    password: string;
    role?: string;
    remark?: string;
  };

  type crmHospitalAccountParams = {
    id: number;
    userId: number;
  };

  type crmHospitalAccountUpdateReq = {
    role?: string;
    status?: number;
    remark?: string;
    username?: string;
    realName?: string;
    phone?: string;
    email?: string;
    password?: string;
  };

  type crmHospitalReq = {
    accountUserId?: number | null;
    hospitalName: string;
    provinceId?: number;
    cityId?: number;
    districtId?: number;
    hospitalAddress?: string;
    hospitalPhone?: string;
    hospitalSelling?: string;
    hospitalWebsite?: string;
    hospitalNature?: number;
    doctorName?: string;
    doctorPhone?: string;
    doctorQq?: string;
    receptionName?: string;
    receptionPhone?: string;
    receptionQq?: string;
    busStation?: string;
    busAddress?: string;
    subwayStation?: string;
    subwayAddress?: string;
    taxiFare?: string;
    vipDiscount?: string;
    returnPoint?: string;
    hospitalIntroduction?: string;
    contractPhotos?: string[];
    wechatOpenid?: string;
    status?: number;
  };

  type crmHospitalSearchQuery = {
    keyword?: string;
    provinceId?: number;
    cityId?: number;
    districtId?: number;
  };

  type crmHospitalUpdateReq = {
    accountUserId?: number | null;
    hospitalName?: string;
    provinceId?: number;
    cityId?: number;
    districtId?: number;
    hospitalAddress?: string;
    hospitalPhone?: string;
    hospitalSelling?: string;
    hospitalWebsite?: string;
    hospitalNature?: number;
    doctorName?: string;
    doctorPhone?: string;
    doctorQq?: string;
    receptionName?: string;
    receptionPhone?: string;
    receptionQq?: string;
    busStation?: string;
    busAddress?: string;
    subwayStation?: string;
    subwayAddress?: string;
    taxiFare?: string;
    vipDiscount?: string;
    returnPoint?: string;
    hospitalIntroduction?: string;
    contractPhotos?: string[];
    wechatOpenid?: string;
    status?: number;
  };

  type crmIdParams = {
    id: number;
  };

  type crmListCustomersParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    startTime?: string;
    endTime?: string;
    statusId?: number;
  };

  type crmListDispatchesParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    startTime?: string;
    endTime?: string;
    statusId?: number;
  };

  type crmListHospitalAccountsParams = {
    id: number;
  };

  type crmListHospitalsParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    startTime?: string;
    endTime?: string;
  };

  type crmListMembersParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    startTime?: string;
    endTime?: string;
  };

  type crmListRegionsParams = {
    parentId?: number;
  };

  type crmMemberReq = {
    numberId?: string;
    name: string;
    gender?: number;
    birthday?: string;
    address?: string;
    mobile?: string;
    project?: string;
    ownerUserId?: number;
  };

  type crmMemberUpdateReq = {
    numberId?: string;
    name?: string;
    gender?: number;
    birthday?: string;
    address?: string;
    mobile?: string;
    project?: string;
    ownerUserId?: number;
  };

  type crmPageQuery = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    startTime?: string;
    endTime?: string;
  };

  type crmRegionListQuery = {
    parentId?: number;
  };

  type crmSearchHospitalsParams = {
    keyword?: string;
    provinceId?: number;
    cityId?: number;
    districtId?: number;
  };

  type crmUpdateCustomerParams = {
    id: number;
  };

  type crmUpdateDispatchParams = {
    id: number;
  };

  type crmUpdateHospitalAccountParams = {
    id: number;
    userId: number;
  };

  type crmUpdateHospitalParams = {
    id: number;
  };

  type crmUpdateMemberParams = {
    id: number;
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

  type deleteAttachmentFolderParams = {
    /** 分组ID */
    id: number;
  };

  type deleteAttachmentParams = {
    /** 素材ID */
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

  type deletePositionParams = {
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
    sortBy?: "sortOrder" | "createdAt" | "updatedAt";
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
    sortBy?: "sortOrder" | "createdAt" | "updatedAt";
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
    sortBy?: "sortOrder" | "createdAt" | "updatedAt";
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

  type disablePluginParams = {
    name: string;
  };

  type enablePluginParams = {
    name: string;
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
    sortBy?: "sortOrder" | "createdAt" | "updatedAt";
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
    sortBy?: "sortOrder" | "createdAt" | "updatedAt";
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
    sortBy?: "sortOrder" | "createdAt" | "updatedAt";
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
    sortBy?: "sortOrder" | "createdAt" | "updatedAt";
    sortOrder?: "asc" | "desc";
  };

  type getLoginLogDetailParams = {
    /** 日志ID */
    id: number;
  };

  type getLoginLogListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（账号、姓名、IP、提示信息） */
    keyword?: string;
    /** 状态（0-失败，1-成功） */
    status?: "0" | "1";
    /** 开始时间 */
    startTime?: string;
    /** 结束时间 */
    endTime?: string;
    /** 排序字段 */
    sortBy?: "createdAt";
    /** 排序方向 */
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
    sortBy?: "sortOrder" | "createdAt" | "updatedAt";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type getPluginDetailParams = {
    name: string;
  };

  type getPluginSyncLogsParams = {
    name: string;
  };

  type getPositionDetailParams = {
    /** 岗位ID */
    id: string;
  };

  type getPositionListParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（名称、描述） */
    keyword?: string;
    /** 岗位状态 */
    status?: "0" | "1";
    /** 排序字段 */
    sortBy?: "sortOrder" | "createdAt" | "updatedAt";
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

  type getSystemRegionParams = {
    code: number;
  };

  type getSystemRegionPathParams = {
    code: number;
  };

  type getSystemRegionTreeParams = {
    level?: number;
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

  type listSystemRegionsParams = {
    parentCode?: number;
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

  type meGetApiTokenParams = {
    id: number;
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
    sortBy?: "sortOrder" | "createdAt" | "updatedAt";
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
    isDefaultAction: boolean;
    /** 是否外链 */
    isExternalLink: boolean;
    /** 关联功能权限码 */
    permissionCodes: string[];
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
    children?: menuTreeNode[] | null;
  };

  type menuTreeResp = {
    code: number;
    message: string;
    success: boolean;
    data: menuTreeList;
    timestamp: string;
  };

  type meRevokeApiTokenParams = {
    id: number;
  };

  type paginationResponse = {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };

  type permissionCatalogItem = {
    /** 权限码 */
    code: string;
    /** 面向管理员的功能名称 */
    label: string;
    /** 功能说明 */
    description?: string;
    /** 权限分组 */
    group: string;
    /** 来源：core 或插件 ID */
    source: string;
  };

  type permissionCatalogResp = {
    code: number;
    message: string;
    success: boolean;
    data: permissionCatalogItem[];
    timestamp: string;
  };

  type positionDeleteResp = {
    code: number;
    message: string;
    success: boolean;
    data: { id: number };
    timestamp: string;
  };

  type positionDetailResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysPosition;
    timestamp: string;
  };

  type positionListQuery = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（名称、描述） */
    keyword?: string;
    /** 岗位状态 */
    status?: "0" | "1";
    /** 排序字段 */
    sortBy?: "sortOrder" | "createdAt" | "updatedAt";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type positionListResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysPosition[];
    timestamp: string;
    pagination: paginationResponse;
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
    /** 刷新令牌（浏览器场景可省略，从 HttpOnly cookie 读取） */
    refreshToken?: string;
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
    isDefaultAction?: boolean;
    /** 是否外链 */
    isExternalLink?: boolean;
    /** 关联功能权限码 */
    permissionCodes?: string[];
    /** 是否缓存 */
    keepAlive?: boolean;
  };

  type savePositionReq = {
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
    /** 数据权限范围（1-全部数据，2-本部门数据，3-本部门及子部门数据，4-仅本人数据，5-自定义数据） */
    dataScope?: "1" | "2" | "3" | "4" | "5";
    /** 菜单ID列表 */
    menuIds?: number[];
    /** 后端功能/API 权限码列表 */
    permissionCodes?: string[];
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

  type syncPluginMenuParams = {
    name: string;
  };

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

  type sysLoginLog = {
    /** 日志ID */
    id: number;
    /** 用户ID */
    userId?: number;
    /** 登录账号 */
    username: string;
    /** 用户姓名 */
    realName?: string;
    /** 状态（0-失败，1-成功） */
    status: "0" | "1";
    /** 提示信息 */
    message?: string;
    /** IP地址 */
    ipAddress?: string;
    /** User-Agent */
    userAgent?: string;
    /** 创建时间 */
    createdAt: string;
    /** 更新时间 */
    updatedAt: string;
  };

  type sysLoginLogDetailResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysLoginLog;
    timestamp: string;
  };

  type sysLoginLogListQuery = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    pageSize?: number;
    /** 搜索关键词（账号、姓名、IP、提示信息） */
    keyword?: string;
    /** 状态（0-失败，1-成功） */
    status?: "0" | "1";
    /** 开始时间 */
    startTime?: string;
    /** 结束时间 */
    endTime?: string;
    /** 排序字段 */
    sortBy?: "createdAt";
    /** 排序方向 */
    sortOrder?: "asc" | "desc";
  };

  type sysLoginLogListResp = {
    code: number;
    message: string;
    success: boolean;
    data: sysLoginLog[];
    timestamp: string;
    pagination: paginationResponse;
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
    isDefaultAction: boolean;
    /** 是否外链 */
    isExternalLink: boolean;
    /** 关联功能权限码 */
    permissionCodes: string[];
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

  type sysPosition = {
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
    /** 数据权限范围（1-全部数据，2-本部门数据，3-本部门及子部门数据，4-仅本人数据，5-自定义数据） */
    dataScope: "1" | "2" | "3" | "4" | "5";
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
    /** 后端功能/API 权限码列表 */
    permissionCodes?: string[];
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
    isDefaultAction?: boolean;
    /** 是否外链 */
    isExternalLink?: boolean;
    /** 关联功能权限码 */
    permissionCodes?: string[];
    /** 是否缓存 */
    keepAlive?: boolean;
  };

  type updatePositionParams = {
    /** 岗位ID */
    id: string;
  };

  type updatePositionReq = {
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
    /** 数据权限范围（1-全部数据，2-本部门数据，3-本部门及子部门数据，4-仅本人数据，5-自定义数据） */
    dataScope?: "1" | "2" | "3" | "4" | "5";
    /** 菜单ID列表 */
    menuIds?: number[];
    /** 后端功能/API 权限码列表 */
    permissionCodes?: string[];
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
