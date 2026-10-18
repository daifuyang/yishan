import { history } from '@umijs/max';
import {
  AI_PREFILL_ROUTES,
  type AiPrefillTarget,
  setAiPrefill,
} from '@yishan/core-system-admin/ai-prefill';
import {
  Alert,
  Button,
  Descriptions,
  Flex,
  Table,
  type TableColumnsType,
  Tag,
  Typography,
} from 'antd';
import React, { useContext } from 'react';
import {
  AiFormAssistanceContext,
  type AiFormAssistanceValue,
} from '../context/formAssistance';

/**
 * 工具结果的结构化渲染。
 *
 * 关键取舍：结果**不交给模型再叙述一遍**，而是按 `render.kind` 直接渲染成表格 /
 * 详情 / 预填卡片。理由有三：
 * 1. 省一次模型调用（成本）；
 * 2. 模型转述会引入错误——数字、ID、状态标签必须来自数据库原值；
 * 3. 模型转述的内容不受权限约束二次检查，而原始结构化数据是执行链过滤过的。
 *
 * 未知 kind 一律不渲染成 Markdown，而是显示一句「暂不支持的结构」，避免把
 * 未经处理的对象直接塞进气泡里。
 */
type AnyRecord = Record<string, unknown>;

export interface ToolResultPayload {
  readonly ok: boolean;
  readonly data?: unknown;
  readonly render?:
    | { readonly kind: string; readonly payload: unknown }
    | undefined;
  readonly summary?: string;
  readonly error?: string;
}

const STATUS_LABELS: Record<string, string> = {
  '0': '禁用',
  '1': '启用',
  '2': '锁定',
};
const GENDER_LABELS: Record<string, string> = {
  '0': '未知',
  '1': '男',
  '2': '女',
};
const SCOPE_LABELS: Record<string, string> = {
  '1': '全部数据',
  '2': '本部门',
  '3': '本部门及子部门',
  '4': '仅本人',
  '5': '自定义部门',
};

const status = (value: unknown) => (
  <Tag
    color={
      String(value) === '1'
        ? 'green'
        : String(value) === '2'
          ? 'orange'
          : 'default'
    }
  >
    {STATUS_LABELS[String(value)] ?? String(value ?? '-')}
  </Tag>
);

const userColumns: TableColumnsType<AnyRecord> = [
  { title: '用户名', dataIndex: 'username' },
  { title: '姓名', dataIndex: 'realName' },
  { title: '手机号', dataIndex: 'phone' },
  {
    title: '性别',
    dataIndex: 'genderName',
    render: (value: unknown) =>
      GENDER_LABELS[String(value)] ?? String(value ?? '-'),
  },
  { title: '状态', dataIndex: 'status', render: status },
];

const roleColumns: TableColumnsType<AnyRecord> = [
  { title: '角色', dataIndex: 'name' },
  { title: '描述', dataIndex: 'description' },
  {
    title: '数据范围',
    dataIndex: 'dataScope',
    render: (value: unknown) => SCOPE_LABELS[String(value)] ?? '-',
  },
  { title: '状态', dataIndex: 'status', render: status },
];

const departmentColumns: TableColumnsType<AnyRecord> = [
  { title: '部门', dataIndex: 'name' },
  { title: '上级', dataIndex: 'parentName' },
  { title: '负责人', dataIndex: 'leaderName' },
  { title: '状态', dataIndex: 'status', render: status },
];

const TABLE_KINDS: Record<
  string,
  { columns: TableColumnsType<AnyRecord>; title: string }
> = {
  'user.table': { columns: userColumns, title: '用户' },
  'role.table': { columns: roleColumns, title: '角色' },
  'department.table': { columns: departmentColumns, title: '部门' },
};

const PREFILL_LABELS: Record<string, string> = {
  username: '登录名称',
  realName: '真实姓名',
  nickname: '昵称',
  email: '邮箱',
  phone: '手机号码',
  gender: '性别',
  status: '状态',
  deptId: '归属部门',
  deptIds: '归属部门',
  roleIds: '角色',
  name: '部门名称',
  parentId: '上级部门',
  sortOrder: '显示排序',
  description: '描述',
  leaderId: '负责人',
};

const PREFILL_TITLES: Record<AiPrefillTarget, string> = {
  'user.create': '新建用户',
  'user.update': '编辑用户',
  'user.delete': '删除用户',
  'department.create': '新建部门',
};

function ListResult({ kind, payload }: { kind: string; payload: AnyRecord }) {
  const config = TABLE_KINDS[kind];
  const rows = Array.isArray(payload?.items)
    ? (payload.items as AnyRecord[])
    : [];
  const truncated = payload?.truncated === true;
  return (
    <div>
      <Typography.Text strong>
        {config.title}（共 {Number(payload?.total ?? rows.length)} 条，显示{' '}
        {rows.length} 条）
      </Typography.Text>
      <Table<AnyRecord>
        size="small"
        rowKey="id"
        columns={config.columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
      {truncated && (
        <Typography.Text type="secondary">
          结果过多已截断，可以补充关键词或状态再查一次。
        </Typography.Text>
      )}
    </div>
  );
}

function DetailResult({ payload }: { payload: AnyRecord }) {
  const record = (payload?.user ?? payload?.role ?? payload?.department) as
    | AnyRecord
    | undefined;
  if (!record) return null;
  return (
    <Descriptions
      size="small"
      column={2}
      bordered
      items={Object.entries(record)
        .filter(
          ([key, value]) =>
            !['deptIds', 'roleIds', 'menuIds', 'permissionCodes'].includes(
              key,
            ) &&
            value !== null &&
            value !== undefined,
        )
        .map(([key, value]) => ({
          key,
          label: PREFILL_LABELS[key] ?? key,
          children: key === 'status' ? status(value) : String(value),
        }))}
    />
  );
}

function PrefillResult({
  payload,
  requestId,
  assist,
}: {
  payload: AnyRecord;
  requestId?: string;
  assist: AiFormAssistanceValue | null;
}) {
  const target = payload?.target as AiPrefillTarget | undefined;
  const route =
    target && Object.hasOwn(AI_PREFILL_ROUTES, target)
      ? AI_PREFILL_ROUTES[target]
      : undefined;
  const fields = (payload?.fields ?? {}) as AnyRecord;
  const missing = Array.isArray(payload?.missing)
    ? (payload.missing as string[])
    : [];
  const entries = Object.entries(fields);
  const outcome = requestId ? assist?.outcomes[requestId] : undefined;
  const apply = () => {
    if (!target || !route) return;
    // 只放字段，目标路由由本地白名单解析；模型无法指定页面。
    const request = { target, fields, missing, requestId };
    if (assist?.requestPrefill) {
      assist.requestPrefill(request);
      return;
    }
    setAiPrefill(request);
    history.push(route);
  };
  return (
    <div>
      {outcome && (
        <Alert
          type={
            outcome.status === 'completed'
              ? 'success'
              : outcome.status === 'failed'
                ? 'error'
                : 'info'
          }
          title={outcome.message}
        />
      )}
      <Typography.Text strong>
        已为「{target && route ? PREFILL_TITLES[target] : '表单'}」提取{' '}
        {entries.length} 个字段
      </Typography.Text>
      {entries.length > 0 && (
        <Descriptions
          size="small"
          column={1}
          bordered
          items={entries.map(([key, value]) => ({
            key,
            label: PREFILL_LABELS[key] ?? key,
            children: String(value),
          }))}
        />
      )}
      {missing.length > 0 && (
        <Alert
          type="info"
          showIcon
          message={`还需你补充：${missing.map((key) => PREFILL_LABELS[key] ?? key).join('、')}`}
          style={{ marginTop: 8 }}
        />
      )}
      <Flex
        gap={8}
        style={{
          marginTop: 8,
          display: outcome?.status === 'completed' ? 'none' : undefined,
        }}
      >
        <Button type="primary" size="small" onClick={apply} disabled={!route}>
          打开表单并预填
        </Button>
        <Typography.Text type="secondary" style={{ alignSelf: 'center' }}>
          预填不会自动保存，仍需你在表单里确认提交。
        </Typography.Text>
      </Flex>
    </div>
  );
}

/**
 * 草稿卡片。
 *
 * **不渲染第二个表单**：这里只有「当前协助目标 / 还缺什么 / 真实结果 / 继续填写」，
 * 可编辑的值永远只有原生 `UserForm` 那一处（设计 §6）。卡片本身没有任何副作用 ——
 * 历史消息重放时它只是被画出来，只有用户点「继续填写」才会去读服务器上最新的草稿。
 *
 * 协作 context 是可选的（卡片也可能被单独渲染），因此用 `useContext` 而不是 `useAiChat`：
 * 没有 Provider 时「继续填写」按钮不出现，其余卡片照常工作。
 */
function DraftResult({
  payload,
  renderPayload,
  assist,
}: {
  payload: AnyRecord;
  renderPayload: AnyRecord;
  assist: AiFormAssistanceValue | null;
}) {
  // 缺失项与校验错误在 `data` 上；`render.payload` 只有草稿引用。三处都可能有
  // draftId，`data` 是能力结果的权威位置 —— 只读顶层曾经读到 `''`，于是「继续填写」
  // 带着空 ID 去读草稿（`draftId must NOT have fewer than 1 characters`），
  // 顺带让所有回执按 `''` 查找而永远查不到。
  const data = ((payload as { data?: unknown }).data ?? {}) as AnyRecord;
  const draftId = String(
    data.draftId ?? renderPayload.draftId ?? payload.draftId ?? '',
  );
  const missing = (
    Array.isArray(data.missingFields) ? data.missingFields : []
  ) as { label: string; mustCompleteInForm?: boolean }[];
  const errors = (
    Array.isArray(data.validationErrors) ? data.validationErrors : []
  ) as { label: string; message: string }[];
  const outcome = assist?.outcomes[draftId];
  // `ready` 只表示「对话该问的都问了」，密码一类仍要在表单里补（设计 §9）。
  const askUser = missing.filter((field) => !field.mustCompleteInForm);
  const inForm = missing.filter((field) => field.mustCompleteInForm);
  return (
    <div>
      <Typography.Text strong>正在协助：新建用户</Typography.Text>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
        信息已存在草稿里，助手不会替你保存：仍需你在表单里核对并点击「确定」。
      </Typography.Paragraph>
      {askUser.length > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 8 }}
          message={`还需你确认：${askUser.map((field) => field.label).join('、')}`}
        />
      )}
      {inForm.length > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 8 }}
          message={`${inForm
            .map((field) => field.label)
            .join('、')} 需要你在表单里填写，助手不会代填。`}
        />
      )}
      {errors.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 8 }}
          message={errors
            .map((error) => `${error.label}${error.message}`)
            .join('；')}
        />
      )}
      {outcome && (
        <Alert
          type={
            outcome.status === 'completed'
              ? 'success'
              : outcome.status === 'failed'
                ? 'error'
                : 'info'
          }
          showIcon
          style={{ marginBottom: 8 }}
          message={outcome.message}
        />
      )}
      {assist && draftId && (
        <Button
          type="primary"
          size="small"
          onClick={() => assist.requestRestore(draftId)}
        >
          继续填写
        </Button>
      )}
    </div>
  );
}

const NAVIGATE_LABELS: Record<string, string> = {
  user_list: '用户管理',
  role_list: '角色管理',
  department_list: '部门管理',
  position_list: '岗位管理',
  menu_list: '菜单管理',
  dict_list: '字典管理',
};

const NAVIGATE_ROUTES: Record<string, string> = {
  user_list: '/system/user',
  role_list: '/system/role',
  department_list: '/system/department',
  position_list: '/system/position',
  menu_list: '/system/menu',
  dict_list: '/system/dict',
};

function NavigateResult({ payload }: { payload: AnyRecord }) {
  const target = String(payload?.target ?? '');
  // 本地白名单兜底：即便服务端返回了别的路径，也不跳转。
  const path = Object.hasOwn(NAVIGATE_ROUTES, target)
    ? NAVIGATE_ROUTES[target]
    : undefined;
  if (!path) return null;
  return (
    <Button
      size="small"
      type="link"
      onClick={() => history.push(path)}
      style={{ paddingInline: 0 }}
    >
      前往{NAVIGATE_LABELS[target] ?? path} →
    </Button>
  );
}

export function AiToolResultCard({
  payload,
  requestId,
}: {
  payload: ToolResultPayload;
  requestId?: string;
}) {
  // 草稿卡片需要 Provider 才能显示「继续填写」与真实结果；没有它时其余卡片照常工作。
  // 用轻量的协作 context（而不是 AiChatProvider）：卡片不需要聊天引擎。
  const assist = useContext(AiFormAssistanceContext);
  const content = (() => {
    if (!payload?.ok) {
      return (
        <Alert
          type="warning"
          showIcon
          message={payload?.error ?? '该操作未执行'}
        />
      );
    }
    const kind = payload.render?.kind;
    const renderPayload = (payload.render?.payload ?? {}) as AnyRecord;
    if (!kind) return null;
    if (Object.hasOwn(TABLE_KINDS, kind))
      return <ListResult kind={kind} payload={renderPayload} />;
    if (kind.endsWith('.detail'))
      return <DetailResult payload={renderPayload} />;
    if (kind === 'form.prefill')
      return (
        <PrefillResult
          payload={renderPayload}
          requestId={requestId}
          assist={assist}
        />
      );
    if (kind === 'action.confirm') {
      const target = renderPayload.target;
      if (
        target !== 'user.delete' ||
        !Number.isSafeInteger(renderPayload.id) ||
        Number(renderPayload.id) < 1
      )
        return <Alert type="error" title="删除目标无效，请重新查询" />;
      const outcome = requestId ? assist?.outcomes[requestId] : undefined;
      return (
        <Flex vertical gap={8}>
          <Alert
            type={outcome?.status === 'completed' ? 'success' : 'warning'}
            title={outcome?.message || '删除操作等待确认'}
            description={
              outcome?.status === 'completed'
                ? undefined
                : '目标：' +
                  String(renderPayload.label ?? '') +
                  '（ID：' +
                  String(renderPayload.id) +
                  '）'
            }
          />
          {outcome?.status !== 'completed' && (
            <Button
              danger
              onClick={() => {
                const request = {
                  target: 'user.delete' as const,
                  fields: { id: renderPayload.id },
                  missing: [],
                  requestId,
                };
                if (assist?.requestPrefill) assist.requestPrefill(request);
                else {
                  setAiPrefill(request);
                  history.push(AI_PREFILL_ROUTES['user.delete']);
                }
              }}
            >
              打开删除确认
            </Button>
          )}
        </Flex>
      );
    }
    if (kind === 'action.draft')
      return (
        <DraftResult
          payload={payload as unknown as AnyRecord}
          renderPayload={renderPayload}
          assist={assist}
        />
      );
    // `form.schema` / `form.options` 是**只给模型看**的上下文：字段定义与候选名单。
    // 它们没有界面形态，也不该让人看见一条「不支持」的错误提示（设计 §6：卡片不
    // 渲染第二份表单，表单定义只以原生表单为准）。
    if (kind === 'form.schema' || kind === 'form.options') return null;
    if (kind === 'navigate') return <NavigateResult payload={renderPayload} />;
    return (
      <Alert type="info" showIcon message={`暂不支持展示的结果类型：${kind}`} />
    );
  })();
  if (!content) return null;
  return <div style={{ marginBottom: 8 }}>{content}</div>;
}
