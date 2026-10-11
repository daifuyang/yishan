import { withAccountScope } from '../_shared/AdminUI'
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useRef, useState } from "react";
import {
  type AdminAppMenu,
  deleteAdminAppMenu,
  getAdminAppMenuTree,
  reorderAdminAppMenus,
  updateAdminAppMenu,
} from "@/api/admin/appMenu";
import { getSessionVersion } from "@/api/client";
import { Button } from "@/components/atoms";
import { confirmAction, useCanWrite } from "@/hooks";
import { canWriteModuleNow, useRequireAuth } from "@/utils/auth-guard";
import { AdminNotice, AdminPage, errorMessage } from "../_shared/AdminUI";
import { AppMenuEditor } from "./AppMenuEditor";
import { moveAppMenu } from "./order";

function AppMenuPage() {
  const guard = useRequireAuth({ moduleId: "system-app-menu" });
  const allowed = guard.ready && guard.allowed;
  const canCreate = useCanWrite("system:app-menu:create");
  const canUpdate = useCanWrite("system:app-menu:update");
  const canDelete = useCanWrite("system:app-menu:delete");
  const [tree, setTree] = useState<AdminAppMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [editor, setEditor] = useState<{
    id?: number;
    parentId?: number;
    editable: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    if (allowed) {
      setLoading(true);
      setError("");
      getAdminAppMenuTree()
        .then((nodes) => {
          if (active) setTree(nodes);
        })
        .catch((cause) => {
          if (active) setError(errorMessage(cause));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else setTree([]);
    return () => {
      active = false;
    };
  }, [allowed, retry]);
  async function mutate(
    required: string[],
    operation: () => Promise<unknown>,
    confirmation?: string,
  ) {
    if (!mounted.current || locked.current || !canWriteModuleNow("system-app-menu", required))
      return;
    const session = getSessionVersion();
    locked.current = true;
    setBusy(true);
    try {
      if (confirmation && !(await confirmAction({ content: confirmation }))) return;
      if (
        !mounted.current ||
        session !== getSessionVersion() ||
        !canWriteModuleNow("system-app-menu", required)
      )
        return;
      await operation();
      if (
        !mounted.current ||
        session !== getSessionVersion() ||
        !canWriteModuleNow("system-app-menu", required)
      )
        return;
      void Taro.showToast({ title: "操作成功", icon: "success" });
      setRetry((value) => value + 1);
    } catch (cause) {
      if (
        mounted.current &&
        session === getSessionVersion() &&
        canWriteModuleNow("system-app-menu", required)
      )
        void Taro.showToast({ title: errorMessage(cause), icon: "none" });
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function move(record: AdminAppMenu, direction: -1 | 1) {
    const payload = moveAppMenu(tree, record, direction);
    if (payload && canUpdate)
      void mutate(["system:app-menu:update"], () => reorderAdminAppMenus(payload));
  }
  function renderNode(record: AdminAppMenu) {
    return (
      <View className="admin-card" key={record.id}>
        <Text className="admin-name">{record.name}</Text>
        <Text className="admin-meta">
          {record.type === 0 ? "分组" : "应用入口"} · {record.status === "1" ? "启用" : "禁用"} ·
          排序 {record.sortOrder}
        </Text>
        {record.page && <Text className="admin-meta">{record.page}</Text>}
        {record.type === 1 && <Text className="admin-meta">模块：{record.moduleId}</Text>}
        <View className="admin-actions">
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || loading}
            onClick={() => setEditor({ id: record.id, editable: false })}
          >
            详情
          </Button>
          {canUpdate && (
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || loading}
              onClick={() => setEditor({ id: record.id, editable: true })}
            >
              编辑
            </Button>
          )}
          {canCreate && record.type === 0 && (
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || loading}
              onClick={() => setEditor({ parentId: record.id, editable: true })}
            >
              添加入口
            </Button>
          )}
          {canUpdate && (
            <>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy || loading || !moveAppMenu(tree, record, -1)}
                onClick={() => move(record, -1)}
              >
                上移
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy || loading || !moveAppMenu(tree, record, 1)}
                onClick={() => move(record, 1)}
              >
                下移
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy || loading}
                onClick={() =>
                  void mutate(["system:app-menu:update"], () =>
                    updateAdminAppMenu(record.id, { status: record.status === "1" ? "0" : "1" }),
                  )
                }
              >
                {record.status === "1" ? "禁用" : "启用"}
              </Button>
            </>
          )}
          {canDelete && !record.children?.length && (
            <Button
              variant="danger"
              size="sm"
              disabled={busy || loading}
              onClick={() =>
                void mutate(
                  ["system:app-menu:delete"],
                  () => deleteAdminAppMenu(record.id),
                  `确定删除“${record.name}”？关联角色的入口授权将同步移除。`,
                )
              }
            >
              删除
            </Button>
          )}
        </View>
      </View>
    );
  }
  return (
    <AdminPage
      title="工作台管理"
      action={
        allowed && canCreate && !editor ? (
          <Button
            size="sm"
            disabled={busy || loading}
            onClick={() => setEditor({ editable: true })}
          >
            新建
          </Button>
        ) : undefined
      }
    >
      {!allowed ? (
        <AdminNotice>
          {guard.denied ? "无权访问工作台管理" : guard.accessError || "正在验证访问权限"}
        </AdminNotice>
      ) : editor ? (
        <AppMenuEditor
          key={`${editor.id ?? `new-${editor.parentId || 0}`}:${getSessionVersion()}`}
          {...editor}
          groups={tree}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            setRetry((value) => value + 1);
          }}
        />
      ) : (
        <>
          {error && (
            <AdminNotice>
              {error}
              <Button variant="text" onClick={() => setRetry((value) => value + 1)}>
                重试
              </Button>
            </AdminNotice>
          )}
          {loading ? (
            <AdminNotice>加载中…</AdminNotice>
          ) : (
            tree.map((group) => (
              <View key={group.id}>
                {renderNode(group)}
                <View style={{ marginLeft: "12px" }}>{(group.children || []).map(renderNode)}</View>
              </View>
            ))
          )}
          {!loading && !tree.length && !error && <AdminNotice>暂无工作台分组</AdminNotice>}
        </>
      )}
    </AdminPage>
  );
}

export default withAccountScope(AppMenuPage)
