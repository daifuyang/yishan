import {
  CloseOutlined,
  ExpandOutlined,
  HistoryOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MinusOutlined,
  PlusOutlined,
  RobotOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import {
  Actions,
  Bubble,
  type BubbleListProps,
  CodeHighlighter,
  Prompts,
  Sender,
  Welcome,
  XProvider,
} from '@ant-design/x';
import zhCN from '@ant-design/x/es/locale/zh_CN';
import XMarkdown, { type ComponentProps } from '@ant-design/x-markdown';
import '@ant-design/x-markdown/themes/light.css';
import { Alert, Button, Collapse, Flex, Spin, theme } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useState } from 'react';
import {
  normalizeCodeLanguage,
  toBubbleItems,
  toolResults,
} from '../adapters/messages';
import { useAiChat } from '../hooks/useAiChat';
import { AiToolResultCard, type ToolResultPayload } from './AiToolResultCard';
import { ConversationList } from './ConversationList';

const useStyles = createStyles(({ token, css }) => ({
  layout: css`
    height: 100%; min-height: 0; display: flex; overflow: hidden;
    color: ${token.colorText}; background: ${token.colorBgContainer};
    border-radius: ${token.borderRadiusLG}px;
  `,
  sidebar: css`
    width: 250px; min-width: 200px; padding: 12px; overflow: auto;
    background: ${token.colorBgLayout}; border-right: 1px solid ${token.colorBorderSecondary};
    @media (max-width: 768px) { display: none; }
  `,
  main: css`flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column;`,
  header: css`
    padding: 12px 16px; min-height: 56px; border-bottom: 1px solid ${token.colorBorderSecondary};
    display: flex; justify-content: space-between; align-items: center; gap: 8px;
    /* 浮窗标题栏是唯一的拖动区域：光标与选中行为必须和手势一致。 */
    &[data-drag-handle='title'] { cursor: grab; user-select: none; }
    @media (max-width: 480px) { padding: 8px; gap: 4px; }
  `,
  history: css`overflow: auto; flex: 1; min-height: 0; padding: 12px;`,
  messages: css`
    flex: 1; min-height: 0; overflow: hidden;
    .ant-bubble-list { height: 100%; padding: 20px; box-sizing: border-box; }
    .ant-bubble-content { max-width: 100%; overflow-wrap: anywhere; }
    .ant-bubble-body { min-width: 0; }
    .ant-bubble-start .ant-bubble-body { max-width: 100%; }
    table { display: block; max-width: 100%; overflow-x: auto; }
    pre { max-width: 100%; overflow-x: auto; }
  `,
  welcome: css`padding: 32px 20px; height: 100%; max-width: 900px; margin: 0 auto; overflow: auto; box-sizing: border-box;`,
  sender: css`padding: 12px 16px 16px; width: 100%; max-width: 900px; align-self: center; box-sizing: border-box;`,
  mobileHistory: css`@media (min-width: 769px) { display: none; }`,
  desktopCollapse: css`@media (max-width: 768px) { display: none; }`,
}));

function MarkdownCode({ block, children, lang }: ComponentProps) {
  const { token } = theme.useToken();
  if (!block) return <code>{children}</code>;
  const code = String(children ?? '').replace(/\n$/, '');
  return (
    <CodeHighlighter
      lang={normalizeCodeLanguage(lang)}
      highlightProps={{
        customStyle: {
          background: token.colorFillTertiary,
          color: token.colorText,
        },
        codeTagProps: { style: { color: token.colorText } },
      }}
      header={
        <Flex justify="space-between" align="center">
          <span>{lang || '代码'}</span>
          <Actions.Copy text={code} />
        </Flex>
      }
    >
      {code}
    </CodeHighlighter>
  );
}
function MarkdownPre({ children }: ComponentProps) {
  return <div>{children}</div>;
}
const markdownComponents = { code: MarkdownCode, pre: MarkdownPre };

function MarkdownReply({
  content,
  streaming,
}: {
  content: string;
  streaming: boolean;
}) {
  const { token } = theme.useToken();
  const style: React.CSSProperties & Record<`--${string}`, string | number> = {
    '--font-size': `${token.fontSize}px`,
    '--primary-color': token.colorPrimary,
    '--primary-color-hover': token.colorPrimaryHover,
    '--heading-color': token.colorTextHeading,
    '--text-color': token.colorText,
    '--border-color': token.colorBorderSecondary,
    '--line-color': token.colorSplit,
    '--light-bg': token.colorFillTertiary,
    '--table-head-bg': token.colorFillAlter,
    '--table-body-bg': token.colorBgContainer,
    '--cite-bg': token.colorFillSecondary,
    '--cite-hover-bg': token.colorFill,
  };
  return (
    <XMarkdown
      className="x-markdown-light"
      style={style}
      content={content}
      escapeRawHtml
      components={markdownComponents}
      streaming={{ hasNextChunk: streaming }}
    />
  );
}

const bubbleRoles: BubbleListProps['role'] = {
  user: {
    placement: 'end',
    variant: 'filled',
    contentRender: (text: string) => (
      <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>
    ),
  },
  assistant: {
    placement: 'start',
    variant: 'borderless',
    contentRender: (text: string, info) => (
      <MarkdownReply content={text} streaming={info.status === 'updating'} />
    ),
  },
};
const prompts = [
  {
    key: 'user-lookup',
    label: '查用户',
    description: '帮我查一下状态为启用的用户有哪些',
  },
  {
    key: 'dept-owner',
    label: '查部门',
    description: '研发部下面有哪些子部门，负责人是谁',
  },
  {
    key: 'create-user',
    label: '新建用户',
    description: '帮我准备一个新建用户的表单，手机号 13800000000，真实姓名张三',
  },
  {
    key: 'role-list',
    label: '查角色',
    description: '系统里都有哪些角色',
  },
];

export function AiChatView({
  floating = false,
  onExpand,
  onMinimize,
  onClose,
  headerProps,
}: {
  floating?: boolean;
  onExpand?: () => void;
  onMinimize?: () => void;
  onClose?: () => void;
  /** 浮窗把拖动手势挂到**标题栏**上（设计 §4：只在标题栏拖动）。 */
  headerProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  const chat = useAiChat();
  const { styles } = useStyles();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    void chat.loadConversations();
  }, [chat.authorized]);
  const lastMessage = chat.messages.at(-1);
  const items = toBubbleItems(chat.messages, chat.busy).map((item) => {
    const message = chat.messages.find((entry) => entry.id === item.key);
    const results =
      item.role === 'assistant' && message ? toolResults(message) : [];
    const hasStructuredResult = results.some(
      (result) => result.output.ok === true && result.output.render,
    );
    return {
      ...item,
      loading: item.loading && results.length === 0,
      ...(hasStructuredResult
        ? {
            contentRender: (text: string) =>
              text.trim() &&
              text.trim() !== '已处理。' &&
              !results.some(
                (result) => result.output.summary === text.trim(),
              ) ? (
                <Collapse
                  ghost
                  size="small"
                  items={[
                    {
                      key: 'explanation',
                      label: '补充说明',
                      children: (
                        <MarkdownReply
                          content={text}
                          streaming={item.streaming === true}
                        />
                      ),
                    },
                  ]}
                />
              ) : null,
          }
        : {}),
      header: (() => {
        // 结果始终由卡片展示，模型的补充解释默认折叠，避免同一份数据出现两张表。
        if (item.role !== 'assistant') return undefined;
        if (!results.length) return undefined;
        return (
          <Flex vertical gap={8} style={{ width: '100%' }}>
            {results.map((result) => (
              <AiToolResultCard
                key={result.toolCallId}
                payload={result.output as unknown as ToolResultPayload}
              />
            ))}
          </Flex>
        );
      })(),
      footer:
        item.role === 'assistant' && !item.streaming && !item.loading ? (
          <Flex gap={4}>
            <Actions.Copy text={String(item.content)} />
            {item.key === lastMessage?.id && (
              <Button
                type="text"
                size="small"
                icon={<SyncOutlined />}
                disabled={chat.busy || chat.loading}
                onClick={() => {
                  void chat.regenerate(lastMessage?.id);
                }}
              >
                重新生成
              </Button>
            )}
          </Flex>
        ) : item.role === 'user' &&
          item.key === lastMessage?.id &&
          !chat.busy ? (
          <Button
            type="text"
            size="small"
            icon={<SyncOutlined />}
            disabled={chat.loading}
            onClick={() => {
              void chat.retry();
            }}
          >
            重新生成回复
          </Button>
        ) : undefined,
    };
  });
  return (
    <XProvider locale={zhCN}>
      <div className={styles.layout}>
        {!floating && !sidebarCollapsed && (
          <aside className={styles.sidebar} aria-label="对话历史">
            <ConversationList />
          </aside>
        )}
        <section className={styles.main} aria-label="AI 对话">
          <div
            className={styles.header}
            {...headerProps}
            data-drag-handle={floating ? 'title' : undefined}
          >
            <Flex gap={8} align="center" style={{ minWidth: 0, flex: 1 }}>
              {!floating && (
                <Button
                  className={styles.desktopCollapse}
                  type="text"
                  icon={
                    sidebarCollapsed ? (
                      <MenuUnfoldOutlined />
                    ) : (
                      <MenuFoldOutlined />
                    )
                  }
                  aria-label={
                    sidebarCollapsed ? '展开对话历史' : '折叠对话历史'
                  }
                  title={sidebarCollapsed ? '展开对话历史' : '折叠对话历史'}
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                />
              )}
              <RobotOutlined />
              <strong
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {chat.conversations.find((item) => item.id === chat.activeId)
                  ?.title || 'AI 助手'}
              </strong>
            </Flex>
            <Flex gap={2} style={{ flexShrink: 0 }}>
              <Button
                type="text"
                icon={<PlusOutlined />}
                aria-label="新建对话"
                title="新建对话"
                disabled={chat.busy || chat.loading}
                onClick={() => {
                  chat.newConversation();
                  setHistoryOpen(false);
                }}
              />
              <Button
                className={floating ? undefined : styles.mobileHistory}
                type="text"
                icon={<HistoryOutlined />}
                aria-label="对话历史"
                title="对话历史"
                onClick={() => setHistoryOpen(!historyOpen)}
              />
              {onExpand && (
                <Button
                  type="text"
                  icon={<ExpandOutlined />}
                  aria-label="展开为页面"
                  title="展开为页面"
                  onClick={onExpand}
                />
              )}
              {onMinimize && (
                <Button
                  type="text"
                  icon={<MinusOutlined />}
                  aria-label="切换为浮层"
                  title="切换为浮层"
                  onClick={onMinimize}
                />
              )}
              {onClose && (
                <Button
                  type="text"
                  icon={<CloseOutlined />}
                  aria-label="关闭 AI 助手"
                  title="关闭 AI 助手"
                  onClick={onClose}
                />
              )}
            </Flex>
          </div>
          {chat.error && (
            <Alert
              type="error"
              title={chat.error}
              showIcon
              closable
              onClose={chat.clearError}
              action={
                <Button
                  size="small"
                  disabled={chat.busy || chat.loading}
                  onClick={() => {
                    void chat.retry();
                  }}
                >
                  重试
                </Button>
              }
            />
          )}
          {historyOpen ? (
            <div className={styles.history}>
              <ConversationList onSelected={() => setHistoryOpen(false)} />
            </div>
          ) : (
            <>
              <div
                className={styles.messages}
                aria-live="polite"
                aria-busy={chat.busy || chat.loading}
              >
                {chat.loading ? (
                  <Flex
                    justify="center"
                    align="center"
                    style={{ height: '100%' }}
                  >
                    <Spin />
                  </Flex>
                ) : items.length ? (
                  <Bubble.List
                    autoScroll
                    style={{
                      maxWidth: 900,
                      marginInline: 'auto',
                      width: '100%',
                    }}
                    role={bubbleRoles}
                    items={items}
                  />
                ) : (
                  <Flex vertical gap={24} className={styles.welcome}>
                    <Welcome
                      variant="borderless"
                      icon={<RobotOutlined />}
                      title="你好，我是 AI 业务助手"
                      description="我可以查用户 / 角色 / 部门、帮你预填新增表单、带你去管理页面。不会替你保存任何数据。"
                    />
                    <Prompts
                      items={prompts}
                      vertical
                      onItemClick={({ data }) => {
                        chat.setDraft(String(data.description || ''));
                      }}
                    />
                  </Flex>
                )}
              </div>
              <div className={styles.sender}>
                <Sender
                  value={chat.draft}
                  onChange={chat.setDraft}
                  loading={chat.busy}
                  disabled={chat.loading || !chat.authorized}
                  onSubmit={(value) => {
                    void chat.send(value);
                  }}
                  onCancel={() => {
                    void chat.stop();
                  }}
                  placeholder="向 AI 提问，Enter 发送，Shift+Enter 换行"
                  autoSize={{ minRows: 2, maxRows: 5 }}
                />
              </div>
            </>
          )}
        </section>
      </div>
    </XProvider>
  );
}
