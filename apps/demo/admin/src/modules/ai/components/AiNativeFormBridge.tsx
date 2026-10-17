import { history } from '@umijs/max';
import { AI_PREFILL_ROUTES } from '@yishan/core-system-admin/ai-prefill';
import {
  APPLY_CONFLICT,
  peekUserCreateFormHandle,
  registerUserCreateDraftLink,
  subscribeUserCreateFormChanges,
  subscribeUserCreateFormHandle,
  subscribeUserFormOverlay,
  type UserCreateDraftFields,
  type UserCreateFormHandle,
  type UserFormSnapshot,
} from '@yishan/core-system-admin/form-assistance';
import { Alert, Modal, Table, type TableColumnsType } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AiFormAssistanceHandlers,
  FormUiRequest,
} from '../context/formAssistance';
import { useAiChat } from '../hooks/useAiChat';
import {
  type ActionDraft,
  getActionDraft,
  patchActionDraft,
} from '../services/actionDraftService';
import { chatError } from '../services/aiChatService';

/**
 * AiNativeFormBridge —— 聊天与**原生** `UserForm` 之间唯一的接线板。
 *
 * 它能做的事只有三件，全部是「定位与填充」：
 *
 * 1. 打开原生新建用户表单，并把草稿里的非敏感字段应用上去（`handle.open/apply`）。
 * 2. 把用户在表单里的手动修改**合并延迟**后 PATCH 回草稿（设计 §6）。
 * 3. 在人工点「确定」时提供一个**不含创建动作**的链接：同步字段 + 返回精确草稿版本。
 *
 * 它**不能**做的事，本文件里也刻意不 import：
 *
 * - 任何 `createUser` / 业务创建请求。聊天里的「直接创建」「我确认了」在这里连一个函数
 *   都拿不到 —— 创建只发生在 `UserForm` 自己的 `onFinish` 里（设计 §10）。
 * - `apply` 的字段版本来自 `snapshot()`，因此迟到的补丁会因为版本/实例/身份不符而被
 *   `UserForm` 自己拒掉。
 * - 密码：下面所有载荷都来自 `snapshot.fields`，它已剔除 password。
 */

/** 短延迟合并：够吸收一次连续输入，又不至于让下一轮对话读到过期草稿。 */
const SYNC_DEBOUNCE_MS = 600;
/** 等原生表单注册句柄的上限；用户没装/没挂载协作表单时不该无限等下去。 */
const HANDLE_WAIT_MS = 3000;
const USER_LIST_ROUTE = AI_PREFILL_ROUTES['user.create'];

const FIELD_LABELS: Record<string, string> = {
  username: '登录名称',
  realName: '真实姓名',
  nickname: '用户昵称',
  email: '邮箱',
  phone: '手机号码',
  gender: '性别',
  status: '状态',
  deptIds: '归属部门',
  roleIds: '角色',
  birthDate: '出生日期',
};

const label = (key: string) => FIELD_LABELS[key] ?? key;
const show = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '（空）';
  return Array.isArray(value) ? value.join('、') : String(value);
};

/** 服务端已结束、不可能再被编辑或恢复的草稿状态。 */
const CLOSED_STATUSES = new Set([
  'completed',
  'cancelled',
  'expired',
  'submitting',
]);

/**
 * 把「表单当前值」与「已同步到草稿的值」求差。
 *
 * 删除的键用 `null` 表达（服务端语义是「清空」）；省略与 `null` 在这里必须区分，
 * 否则一次输入就会把用户没碰过的可选字段清掉。
 */
export function diffDraftFields(
  synced: Record<string, unknown>,
  current: Record<string, unknown>,
): Record<string, string | number[] | null> {
  const patch: Record<string, string | number[] | null> = {};
  for (const [key, value] of Object.entries(current)) {
    // 双保险：密码即使出现在任何来源里也不进同步负载。
    if (key === 'password') continue;
    if (JSON.stringify(synced[key]) === JSON.stringify(value)) continue;
    patch[key] = value as string | number[];
  }
  for (const key of Object.keys(synced)) {
    if (key === 'password') continue;
    if (key in current) continue;
    patch[key] = null;
  }
  return patch;
}

/** 等原生表单挂上协作句柄（切换路由后它才会注册）。 */
function waitForHandle(
  timeoutMs = HANDLE_WAIT_MS,
): Promise<UserCreateFormHandle | null> {
  const current = peekUserCreateFormHandle();
  if (current) return Promise.resolve(current);
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: UserCreateFormHandle | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(value);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    const unsubscribe = subscribeUserCreateFormHandle(() =>
      done(peekUserCreateFormHandle()),
    );
  });
}

interface PendingConflict {
  draftId: string;
  fields: Partial<UserCreateDraftFields>;
  rows: { key: string; label: string; old: string; next: string }[];
}

export function AiNativeFormBridge() {
  const chat = useAiChat();
  const { formAssistance } = chat;
  const { identityEpoch, setOutcome } = formAssistance;

  /** 当前正在协助的草稿。它只是「协助目标」，不是可编辑状态。 */
  const activeRef = useRef<{ draftId: string; draftVersion: number } | null>(
    null,
  );
  /** 已经同步进草稿的字段值，用来算差。 */
  const syncedRef = useRef<Record<string, unknown>>({});
  /** 最近一次表单变化。只作为 `patchNow` 不可用时的兜底读数。 */
  const latestRef = useRef<UserFormSnapshot | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 串行化 PATCH：两次同步并发会用同一个旧版本，服务端只会接受一次。 */
  const chainRef = useRef<Promise<unknown>>(Promise.resolve());
  /**
   * 草稿切换序号。
   *
   * `syncedRef` 描述的是**当前**协助的那份草稿，因此一次 PATCH 的结果只有在序号
   * 没变时才允许写回它 —— 否则草稿 A 在途的响应会把已经属于草稿 B 的映射重新填满。
   */
  const seqRef = useRef(0);
  /** 上一次同步失败：提交前必须重新落地，绝不能带着旧版本号去创建。 */
  const syncFailedRef = useRef(false);
  /**
   * 本次协助真正填进**哪个**表单实例。
   *
   * 没有它，「用户关掉表单 → 过一会儿手动新建另一个用户」会被当成同一场协作：新实例
   * 是空的，差算出来是「把草稿清空」，随后的 `prepare()` 还会把这次无关的手动创建
   * 记到那份已被放弃的草稿上（错的记录 + 错关掉一份草稿）。表单实例 id 每次打开
   * 都不同，因此它是唯一可靠的「还是那一个表单吗」凭证。
   */
  const assistedInstanceRef = useRef<string | null>(null);
  /**
   * 助手**正在自己填表**。
   *
   * `open()` 与 `apply()` 之间表单处于中间态：刚打开时是空的，填完才是草稿的内容。
   * 这段时间里算差得到的是「把整个草稿清成 null」，等 600ms 后发出去就把刚填进去的
   * 字段全部抹掉。这段时间内一律不同步 —— 助手写入的值不是用户编辑。
   */
  const fillingDepthRef = useRef(0);
  const epochRef = useRef(identityEpoch);
  epochRef.current = identityEpoch;
  const [conflict, setConflict] = useState<PendingConflict | null>(null);

  /**
   * 切换 / 结束协助中的草稿。
   *
   * `seqRef` 自增让**在途**的 PATCH 结果作废（否则草稿 A 的响应会把已经属于草稿 B 的
   * `syncedRef` 重新填满），定时器与失败标记一并清掉。
   */
  const switchDraft = useCallback(() => {
    seqRef.current += 1;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    syncedRef.current = {};
    latestRef.current = null;
    syncFailedRef.current = false;
    assistedInstanceRef.current = null;
  }, []);

  /**
   * 协助目标是否仍落在**同一个**打开的表单上。
   *
   * 助手填过某个实例之后，用户一旦关掉它（`instanceId` 变空）或另开一个表单
   * （`instanceId` 变了），那份草稿就算被放弃：既不能再往它同步，也不能把它
   * 关联到下一次提交上。
   */
  const stillAssistingThisInstance = useCallback((): boolean => {
    const expected = assistedInstanceRef.current;
    if (!expected) return false;
    const live = peekUserCreateFormHandle()?.snapshot().instanceId ?? '';
    return live === expected;
  }, []);

  const patchNow = useCallback(
    async (patch: Record<string, string | number[] | null>) => {
      const target = activeRef.current;
      if (!target || Object.keys(patch).length === 0) return;
      const epoch = epochRef.current;
      const seq = seqRef.current;
      const run = async () => {
        // 排队期间换了草稿：这份差属于上一份草稿，丢掉而不是写进新的映射。
        if (seq !== seqRef.current || epoch !== epochRef.current) return;
        try {
          const draft = await patchActionDraft(
            target.draftId,
            target.draftVersion,
            patch,
          );
          // 身份或草稿换了就别把这次结果写进来。
          if (seq !== seqRef.current || epoch !== epochRef.current) return;
          target.draftVersion = draft.draftVersion;
          // 这一次真的落地了：清掉失败标记，否则一次瞬时失败会让用户**下一次**点
          // 「确定」也被一句不相关的「同步未成功」挡住。
          syncFailedRef.current = false;
          for (const [key, value] of Object.entries(patch)) {
            if (value === null) delete syncedRef.current[key];
            else syncedRef.current[key] = value;
          }
        } catch (cause) {
          if (seq !== seqRef.current || epoch !== epochRef.current) return;
          syncFailedRef.current = true;
          // 同步失败不丢数据也不静默：告诉用户「草稿没跟上」，提交前还会再试一次。
          setOutcome(target.draftId, {
            status: 'unknown',
            message: `草稿同步失败：${chatError(cause)}。表单内容仍保留，保存时会再试一次。`,
          });
        }
      };
      chainRef.current = chainRef.current.then(run, run);
      await chainRef.current;
    },
    [setOutcome],
  );

  /**
   * 按**当前**表单值算差并同步。延迟窗口到期、`flush` 与提交前的 `prepare` 都走它。
   *
   * 差必须在这里算，不能在 600ms 之前算好：自动填表路径上表单会连发两次变化
   * （`open()` 时的空表单、`apply()` 之后的已填表单），提前算出来的差是
   * 「把整个草稿清空」，等定时器到期就会把刚填进去的字段全部抹掉。
   */
  const syncLatest = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // 助手正在填表：表单值是中间态，此刻算差等于「清空整个草稿」。
    if (fillingDepthRef.current > 0) {
      await chainRef.current;
      return;
    }
    const handle = peekUserCreateFormHandle();
    const current = handle?.snapshot().fields ?? latestRef.current?.fields;
    if (!current || !activeRef.current) {
      await chainRef.current;
      return;
    }
    // 表单已经被关掉 / 换成另一个实例：这份草稿已被放弃，读到的是别人的空表单。
    // 继续算差等于「把这份草稿清空」，必须停手。
    if (!stillAssistingThisInstance()) {
      await chainRef.current;
      return;
    }
    const patch = diffDraftFields(syncedRef.current, current);
    if (Object.keys(patch).length === 0) {
      await chainRef.current;
      return;
    }
    await patchNow(patch);
    await chainRef.current;
  }, [patchNow, stillAssistingThisInstance]);

  /** 用户手改 → 合并延迟后同步（设计 §6）。 */
  const onFormChange = useCallback(
    (snapshot: UserFormSnapshot) => {
      latestRef.current = snapshot;
      if (!activeRef.current || fillingDepthRef.current > 0) return;
      // **先撤掉上一枚定时器**：空差也必须撤。留着它就会在 600ms 后用上一枚
      // 定时器算出来的旧差发一次 PATCH。
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void syncLatest();
      }, SYNC_DEBOUNCE_MS);
    },
    [syncLatest],
  );

  const flush = useCallback(async () => {
    await syncLatest();
  }, [syncLatest]);

  /** 把 `apply` 的结果翻译成给用户的话：成功、被拒、还是需要用户点头。 */
  const reportApplyResult = useCallback(
    (
      draft: ActionDraft,
      fields: Partial<UserCreateDraftFields>,
      handle: UserCreateFormHandle,
      result: { applied: boolean; conflicts: readonly string[] },
    ) => {
      if (!result.applied) {
        const reasons = result.conflicts.filter(
          (item) =>
            !(
              item === APPLY_CONFLICT.instance ||
              item === APPLY_CONFLICT.revision ||
              item === APPLY_CONFLICT.closed ||
              item === APPLY_CONFLICT.target
            ),
        );
        if (reasons.length === 0) {
          setOutcome(draft.draftId, {
            status: 'notice',
            message:
              '表单在你说话期间发生了变化，这次填入没有套用。可以点「继续填写」重试。',
          });
          return;
        }
        // 用户手改过的非空字段：把原值与拟修改值摆出来，**必须**由用户确认后才覆盖。
        // 授权名单来自这份差异，不是补丁的全部键。
        const current = handle.snapshot();
        const rows = reasons
          .filter((key) => key in fields)
          .map((key) => ({
            key,
            label: label(key),
            old: show(current.fields[key as keyof UserCreateDraftFields]),
            next: show(fields[key as keyof UserCreateDraftFields]),
          }));
        if (rows.length === 0) {
          setOutcome(draft.draftId, {
            status: 'notice',
            message: `以下字段当前不允许助手填写：${reasons.map(label).join('、')}。请在表单里手动填写。`,
          });
          return;
        }
        setConflict({ draftId: draft.draftId, fields, rows });
        return;
      }
      setOutcome(
        draft.draftId,
        result.conflicts.length > 0
          ? {
              status: 'conflict',
              // 补丁**写进去了**，只是让某个字段变得不再合法：这是提示，不是失败，
              // 更不该触发一次重试循环（设计 §7）。
              message: `已填入，但${result.conflicts.map(label).join('、')}需要重新选择。`,
            }
          : {
              status: 'notice',
              message: '已填入新建用户表单，请核对后自行保存。',
            },
      );
    },
    [setOutcome],
  );

  /**
   * 把草稿填进**当前实例**的原生表单。
   *
   * 走一遍完整的定位：路由 → 等句柄 → 打开 → 快照 → apply。`apply` 自己会拒掉旧实例、
   * 旧版本、已关闭与非目标表单，这里不重复判断，只把它返回的冲突翻译成给用户的话。
   */
  const applyDraft = useCallback(
    async (draft: ActionDraft, handle: UserCreateFormHandle) => {
      // 填表期间表单值是中间态，一律不参与同步（见 fillingDepthRef）。
      fillingDepthRef.current += 1;
      try {
        const opened = await handle.open();
        const snapshot = opened?.instanceId ? opened : handle.snapshot();
        const fields = (draft.formData ?? {}) as Partial<UserCreateDraftFields>;
        const result = await handle.apply({
          instanceId: snapshot.instanceId,
          baseRevision: snapshot.revision,
          fields,
        });
        if (result.applied) {
          // 记住这次协作落在哪个实例上：只有它还开着，才谈得上「继续同步」。
          assistedInstanceRef.current = snapshot.instanceId;
          // 填完之后重新建立「已同步」基线：助手写入的内容与表单自身的默认值
          // 都不是用户的编辑，既不该被当成差去 PATCH，也不会被当成「要清空」。
          const current = handle.snapshot().fields;
          for (const [key, value] of Object.entries(current)) {
            if (value === undefined || value === null || value === '') continue;
            syncedRef.current[key] = value;
          }
        }
        reportApplyResult(draft, fields, handle, result);
      } finally {
        fillingDepthRef.current = Math.max(0, fillingDepthRef.current - 1);
      }
    },
    [reportApplyResult],
  );

  const loadAndApply = useCallback(
    async (draftId: string, options: { manual: boolean }) => {
      // 用户主动恢复时 `activeRef` 可能还是空的（刷新后第一次点「继续填写」），
      // 因此这里不以它作为前置条件：草稿状态由下面读回来的服务器数据决定。
      let handle = peekUserCreateFormHandle();
      // 未保存的编辑先于任何导航判断：把用户从正在编辑的表单上导航走，
      // 等于用一次自动填入换掉他的输入。
      if (handle && !options.manual) {
        const current = handle.snapshot();
        if (current.instanceId && current.dirtyFields.length > 0) {
          setOutcome(draftId, {
            status: 'blocked',
            message:
              '表单里还有你未保存的修改，已暂停自动填入。核对后点「继续填写」即可。',
          });
          return;
        }
      }
      if (!handle) {
        if (history.location.pathname !== USER_LIST_ROUTE) {
          history.push(USER_LIST_ROUTE);
        }
        handle = await waitForHandle();
      }
      if (!handle) {
        setOutcome(draftId, {
          status: 'unsupported',
          message:
            '当前页面没有接入「新建用户」表单，助手无法代填。请到用户管理页手动新建。',
        });
        return;
      }
      let draft: ActionDraft;
      try {
        draft = await getActionDraft(draftId);
      } catch (cause) {
        setOutcome(draftId, {
          status: 'unknown',
          message: `读取草稿失败：${chatError(cause)}`,
        });
        return;
      }
      if (CLOSED_STATUSES.has(draft.status)) {
        setOutcome(draftId, {
          status: 'notice',
          message:
            draft.status === 'completed'
              ? '这份草稿已经完成过一次创建，不会再自动填入。'
              : draft.status === 'submitting'
                ? '这份草稿正在提交中，请等结果出来再操作。'
                : '这份草稿已结束（取消或过期），不会自动新建替代草稿。',
        });
        return;
      }
      // 采纳这份服务器草稿：先作废上一份草稿的在途同步，再以**服务器**的字段
      // 作为「已同步」基线，之后的差都是用户相对它做的编辑。
      switchDraft();
      activeRef.current = {
        draftId,
        draftVersion: draft.draftVersion,
      };
      syncedRef.current = { ...(draft.formData ?? {}) };
      await applyDraft(draft, handle);
    },
    [applyDraft, setOutcome, switchDraft],
  );

  /** 本轮 stream 的自动动作（仅此一条路径会自动开表单）。 */
  const onUiRequest = useCallback(
    (request: FormUiRequest) => {
      if (request.identityEpoch !== epochRef.current) return;
      if (activeRef.current && activeRef.current.draftId !== request.draftId) {
        // 一次只协助一份草稿：换草稿会丢掉上一个的同步上下文。
        switchDraft();
      }
      activeRef.current = {
        draftId: request.draftId,
        draftVersion: request.draftVersion,
      };
      void loadAndApply(request.draftId, { manual: false });
    },
    [loadAndApply, switchDraft],
  );

  const onRestore = useCallback(
    (draftId: string) => {
      // 用户主动恢复：此时才读服务器上最新的那份草稿，不顺带新建替代草稿。
      void loadAndApply(draftId, { manual: true });
    },
    [loadAndApply],
  );

  const handlers = useRef<AiFormAssistanceHandlers>({
    onUiRequest: () => {},
    onRestore: () => {},
    flush: async () => {},
  });
  handlers.current = { onUiRequest, onRestore, flush };
  const handlersRef = useRef(handlers.current);

  useEffect(
    () => formAssistance.bindHandlers(handlersRef.current),
    [formAssistance],
  );

  /**
   * 草稿链接：**只有草稿，没有创建**。
   *
   * `prepare()` 在 `UserForm` 的人工「确定」里被调用：把待同步的非敏感字段落地，返回
   * 锁定的精确版本。`reconcile()` 在创建请求抛异常后被调用，只读查草稿状态 ——
   * 客户端**不自动重发**创建（设计 §11）。真正的创建仍然是表单自己的 `createUser`。
   */
  const prepare = useCallback(async () => {
    const target = activeRef.current;
    // 从来没有协助中的草稿 → 这次提交与草稿无关，普通创建，行为与从前一致。
    if (!target) return null;
    const handle = peekUserCreateFormHandle();
    // 有协助中的草稿却拿不到打开的表单：**硬失败**，不降级成一次不带草稿关联的
    // 创建 —— 那会绕开服务端「同一草稿最多完成一次创建」的保证（设计 §11）。
    if (!handle || !handle.snapshot().instanceId) {
      throw new Error('草稿协作表单已不可用，本次未创建');
    }
    // 用户已经把这份草稿的表单关掉（或另开了一个）：这次提交与它无关。
    // 同样**不**降级成普通创建 —— 那会让一次手动新建悄悄「完成」一份早被放弃的
    // 草稿，服务端只会把错的那条记成这次创建的结果。
    if (!stillAssistingThisInstance()) {
      setOutcome(target.draftId, {
        status: 'notice',
        message:
          '之前那份草稿的表单已经关掉了，这次保存不会算作它的创建。需要代填请重新点「继续填写」。',
      });
      throw new Error('草稿表单已被关闭，本次不会关联该草稿');
    }
    await syncLatest();
    // 同步没落定就不能锁定版本号：带着 patch 之前的版本去创建，draftSubmission
    // 指的就不是用户刚核对的那一版草稿。
    if (syncFailedRef.current) {
      syncFailedRef.current = false;
      throw new Error('草稿同步未成功，本次未创建');
    }
    return { draftId: target.draftId, draftVersion: target.draftVersion };
  }, [setOutcome, stillAssistingThisInstance, syncLatest]);

  const reconcile = useCallback(async (): Promise<
    'completed' | 'failed' | 'unknown'
  > => {
    const target = activeRef.current;
    if (!target) return 'unknown';
    try {
      const draft = await getActionDraft(target.draftId);
      if (draft.status === 'completed') {
        activeRef.current = null;
        switchDraft();
        setOutcome(draft.draftId, {
          status: 'completed',
          message: '用户已保存，用户创建成功。',
        });
        return 'completed';
      }
      if (draft.status === 'failed') {
        setOutcome(draft.draftId, {
          status: 'failed',
          message: draft.failureReason
            ? `保存失败：${draft.failureReason}。表单内容与密码已保留，修改后可再次保存。`
            : '保存失败。表单内容与密码已保留，修改后可再次保存。',
        });
        return 'failed';
      }
      setOutcome(draft.draftId, {
        status: 'unknown',
        message: '结果仍在确认中，请稍后刷新查看；不要重复保存。',
      });
      return 'unknown';
    } catch {
      // 连草稿都读不到时同样**不重发**创建：宁可让用户自己看一眼再点。
      return 'unknown';
    }
  }, [setOutcome]);

  const linkRef = useRef({ prepare, reconcile });
  linkRef.current = { prepare, reconcile };
  useEffect(() => registerUserCreateDraftLink(linkRef.current), []);

  // 身份变了：丢掉上一个账号的协作目标（设计 §7）。
  useEffect(() => {
    switchDraft();
    activeRef.current = null;
    setConflict(null);
  }, [identityEpoch, switchDraft]);

  // 表单变化 → 合并延迟同步。
  useEffect(() => subscribeUserCreateFormChanges(onFormChange), [onFormChange]);

  // 表单开着时全屏助手让位给浮窗（设计 §4）：同一份聊天状态，两种外层。
  useEffect(
    () =>
      subscribeUserFormOverlay((info) => {
        if (info?.open && chat.viewMode === 'fullscreen') chat.minimize();
      }),
    [chat],
  );

  const confirmColumns: TableColumnsType<PendingConflict['rows'][number]> = [
    { title: '字段', dataIndex: 'label', width: 120 },
    { title: '表单里现在的值', dataIndex: 'old' },
    { title: '助手要填的值', dataIndex: 'next' },
  ];

  return (
    <Modal
      open={Boolean(conflict)}
      title="确认覆盖你在表单里改过的内容"
      okText="确认覆盖"
      cancelText="保留我的"
      onCancel={() => setConflict(null)}
      onOk={async () => {
        const current = conflict;
        setConflict(null);
        if (!current) return;
        const handle = peekUserCreateFormHandle();
        if (!handle) return;
        const snapshot = handle.snapshot();
        // 只授权用户**刚刚确认过的那些字段**，不是补丁的全部键。
        const result = await handle.apply({
          instanceId: snapshot.instanceId,
          baseRevision: snapshot.revision,
          fields: current.fields,
          authorizedFields: current.rows.map((row) => row.key),
        });
        if (!result.applied) {
          setOutcome(current.draftId, {
            status: 'notice',
            message: '表单在你确认期间又变了，这次填入没有套用。',
          });
          return;
        }
        setOutcome(
          current.draftId,
          result.conflicts.length > 0
            ? {
                status: 'conflict',
                message: `已填入，但${result.conflicts.map(label).join('、')}需要重新选择。`,
              }
            : {
                status: 'notice',
                message: '已填入新建用户表单，请核对后自行保存。',
              },
        );
      }}
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message="这些字段你在表单里改过，覆盖前请确认。"
      />
      <Table
        size="small"
        rowKey="key"
        pagination={false}
        columns={confirmColumns}
        dataSource={conflict?.rows ?? []}
      />
    </Modal>
  );
}
