import { Flex, Typography } from 'antd';
import React from 'react';
import { ToolCallCard } from '../components/ToolCallCard';
import { ToolResultLine } from '../components/ToolResultLine';
import type { ToolCallViewModel, ToolRendererProps } from '../model';
import { record, text } from '../safe-data';

/**
 * `discover_operations` 的专属渲染器。
 *
 * 这个工具的返回是**一组业务能力定义**（`user.create.form` / `user.create` …）。
 * 面向普通用户，它只回答一个问题：「你要的那个功能，找到了吗、能干什么」。
 *
 * 展示约定：
 * 1. 标题用自然中文（「查找新建用户功能」），不出现工具名、能力 ID、内部分类；
 * 2. 默认收起，展开后是一列纯文字结果，没有二级折叠、没有跳转、没有表格；
 * 3. 「工具跑完了」和「业务数据建好了」是两件事——这里只说找没找到。
 *
 * 文案不是按能力 ID 硬编码的：先读业务注册信息里的中文名称和元数据
 * （`name` / `presentation.subject` / `presentation.kind` / `type`），能识别出
 * 业务对象与动作就组装成「已找到用户信息填写入口」这类句子；识别不出来就降级为
 * 「已找到：{业务中文名称}」，不猜测用途。
 */

/** 能力类型 → 展示动作。未知类型不猜，按业务名称降级展示。 */
type CapabilityAction =
  | 'form'
  | 'create'
  | 'update'
  | 'delete'
  | 'query'
  | 'describe';

/** 动作 → 结果句尾的语义描述。 */
const ACTION_SUFFIX: Record<CapabilityAction, string> = {
  form: '信息填写入口',
  create: '创建功能',
  update: '更新功能',
  delete: '删除功能',
  query: '查询功能',
  describe: '查看功能',
};

/**
 * 业务名里常见的前缀动词。
 *
 * 用来把「新增用户」「新建用户」还原成业务对象「用户」——这是从**业务元数据**
 * 推导，不是按能力 ID 猜。
 */
const LEADING_VERBS = [
  '新增',
  '新建',
  '创建',
  '添加',
  '查询',
  '查找',
  '查看',
  '读取',
  '编辑',
  '更新',
  '删除',
  '批量',
];

/** 业务名里常见的后缀，用来把「新增用户表单定义」还原成「新增用户」。 */
const TRAILING_NOUNS = [
  '表单定义',
  '定义',
  '信息',
  '功能',
  '操作',
  '入口',
  '表单',
  '列表',
];

interface Capability {
  /** 能力标识（`user.create`）。只用于判断动作，不直接展示。 */
  id: string;
  /** 面向用户的能力名称（业务注册信息里的中文名）。 */
  name: string;
  /** 能力类型原文（`query` / `create` …）。 */
  type: string;
  /** 服务端声明的展示类型（`form` / `draft` / `list` …）。 */
  kind: string;
  /** 业务对象（`新增用户`）。 */
  subject: string;
}

/**
 * 从业务名里还原业务对象。
 *
 * 「新增用户表单定义」→「新增用户」→「用户」；识别不出来就返回空串，
 * 由调用方降级处理。
 */
function businessNoun(value: string): string {
  let result = value.trim();
  for (const suffix of TRAILING_NOUNS) {
    if (result.endsWith(suffix) && result.length > suffix.length) {
      result = result.slice(0, -suffix.length);
      break;
    }
  }
  for (const verb of LEADING_VERBS) {
    if (result.startsWith(verb) && result.length > verb.length) {
      result = result.slice(verb.length);
      break;
    }
  }
  return result.trim();
}

/**
 * 解析一条能力定义。
 *
 * 没有标识也没有名称的对象不是能力（多半是脏数据），直接丢弃。
 */
function parseCapability(value: unknown): Capability | undefined {
  const item = record(value);
  const id = text(item.id, 120);
  const name = text(item.name, 120);
  if (!id && !name) return undefined;
  const presentation = record(item.presentation);
  return {
    id,
    name,
    type: text(item.type, 40),
    kind: text(presentation.kind, 40),
    subject: text(presentation.subject, 60),
  };
}

/**
 * 从展示模型里取出能力列表。
 *
 * 优先用展示层已经解析好的 `rows`；如果服务端改成了别的形状，退回原始结果里的
 * `operations`。两条路径都来自**真实返回数据**。
 */
function capabilitiesOf(tool: ToolCallViewModel): Capability[] {
  const presentation = tool.presentation;
  const rows =
    presentation.type === 'query' && Array.isArray(presentation.data.rows)
      ? presentation.data.rows
      : [];
  const envelope = record(tool.details.output);
  const operations = record(envelope.data).operations;
  const source = rows.length
    ? rows
    : Array.isArray(operations)
      ? operations
      : [];
  return source
    .map(parseCapability)
    .filter((item): item is Capability => item !== undefined);
}

/**
 * 判断这条能力是「什么动作」。
 *
 * 依据是业务元数据（`presentation.kind`、能力类型、能力标识的形态），
 * 不是某个具体 ID 的白名单。
 */
function actionOf(capability: Capability): CapabilityAction | undefined {
  if (capability.kind === 'form' || capability.id.endsWith('.form'))
    return 'form';
  if (capability.type === 'create' || capability.kind === 'draft')
    return 'create';
  if (capability.type === 'update') return 'update';
  if (capability.type === 'delete') return 'delete';
  if (capability.type === 'describe') return 'describe';
  if (
    capability.type === 'query' ||
    capability.kind === 'list' ||
    capability.kind === 'detail'
  ) {
    return 'query';
  }
  return undefined;
}

/**
 * 一条结果的中文文案。
 *
 * 能识别出业务对象与动作 → 「已找到用户创建功能」；
 * 只有业务名称 → 「已找到：新增用户」；
 * 什么都没有 → 「已找到一项功能」（绝不把技术 ID 亮给用户）。
 */
function resultText(capability: Capability, fallbackSubject: string): string {
  const noun =
    businessNoun(capability.subject) ||
    businessNoun(capability.name) ||
    businessNoun(fallbackSubject);
  const action = actionOf(capability);
  if (noun && action) return `已找到${noun}${ACTION_SUFFIX[action]}`;
  if (capability.name) return `已找到：${capability.name}`;
  return '已找到一项功能';
}

function ResultItem({ text: content }: { text: string }) {
  return <ToolResultLine text={content} />;
}

export function DiscoverOperationsRenderer({
  tool,
  bodyOnly,
}: ToolRendererProps) {
  const capabilities = capabilitiesOf(tool);
  const input = record(tool.details.input);
  const keyword = text(input.keyword, 60);
  // 关键词拿不到时退回服务端声明的业务对象（`progress.subject`）。
  const subject = tool.subtitle;
  const target = keyword || subject;
  const running = tool.status === 'running' || tool.status === 'pending';
  const failed = tool.status === 'error' || tool.status === 'cancelled';

  const title = target
    ? running
      ? `正在查找${target}功能…`
      : `查找${target}功能`
    : running
      ? '正在查找业务功能…'
      : '查找业务功能';

  const resultSummary = failed ? '未完成' : running ? '' : '已完成';

  const view: ToolCallViewModel = {
    ...tool,
    title,
    // 关键词已经写进标题，不再单独重复展示。
    subtitle: '',
    summary: [],
    note: undefined,
    resultSummary,
    // 「没找到结果」是执行成功的一种，不是失败：状态图标仍然是完成。
    empty: false,
  };

  const content = failed ? (
    <Typography.Text type="danger" style={{ overflowWrap: 'anywhere' }}>
      {tool.details.error?.message ||
        '本次查找未完成，可以重新生成回复再试一次。'}
    </Typography.Text>
  ) : capabilities.length ? (
    <Flex vertical gap={8} style={{ minWidth: 0 }}>
      {capabilities.map((capability, index) => (
        <ResultItem
          key={capability.id || `${index}`}
          text={resultText(capability, subject)}
        />
      ))}
    </Flex>
  ) : (
    <Typography.Text type="secondary">暂未找到匹配的功能</Typography.Text>
  );
  if (bodyOnly) return content;
  return (
    <ToolCallCard tool={view} showDetails={false} showError={false} showChevron>
      {content}
    </ToolCallCard>
  );
}
