import { withAccountScope } from '../_shared/AdminUI'
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useRef, useState } from "react";
import {
  type AdminMenu,
  deleteAdminMenu,
  getAdminMenuTree,
  updateAdminMenu,
} from "@/api/admin/menu";
import { getSessionVersion } from "@/api/client";
import { Button } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { confirmAction, useCanWrite } from "@/hooks";
import { canWriteModuleNow, useRequireAuth } from "@/utils/auth-guard";
import { AdminNotice, AdminPage, errorMessage } from "../_shared/AdminUI";
import { MenuEditor } from "./MenuEditor";

function MenuPage() {
  const guard = useRequireAuth({ moduleId: "system-menu" });
  const allowed = guard.ready && guard.allowed;
  const canCreate = useCanWrite("system:menu:create");
  const canUpdate = useCanWrite("system:menu:update");
  const canDelete = useCanWrite("system:menu:delete");
  const [tree, setTree] = useState<AdminMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");
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
      getAdminMenuTree()
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
    if (!mounted.current || locked.current || !canWriteModuleNow("system-menu", required)) return;
    const session = getSessionVersion();
    locked.current = true;
    setBusy(true);
    try {
      if (confirmation && !(await confirmAction({ content: confirmation }))) return;
      if (
        !mounted.current ||
        session !== getSessionVersion() ||
        !canWriteModuleNow("system-menu", required)
      )
        return;
      await operation();
      if (
        !mounted.current ||
        session !== getSessionVersion() ||
        !canWriteModuleNow("system-menu", required)
      )
        return;
      void Taro.showToast({ title: "操作成功", icon: "success" });
      setRetry((value) => value + 1);
    } catch (cause) {
      if (
        mounted.current &&
        session === getSessionVersion() &&
        canWriteModuleNow("system-menu", required)
      )
        void Taro.showToast({ title: errorMessage(cause), icon: "none" });
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function renderNodes(nodes: AdminMenu[], depth = 0) {
    return nodes.map((node) => {
      const children = renderNodes(node.children || [], depth + 1);
      const matches = `${node.name} ${node.path || ""} ${node.component || ""}`
        .toLowerCase()
        .includes(keyword.toLowerCase());
      if (!matches && children.every((child) => child === null)) return null;
      return (
        <View key={node.id}>
          <View className="admin-card" style={{ marginLeft: `${Math.min(depth, 3) * 12}px` }}>
            <Text className="admin-name">{node.name}</Text>
            <Text className="admin-meta">
              {["目录", "页面", "按钮"][node.type]} · {node.status === "1" ? "启用" : "禁用"} · 排序{" "}
              {node.sort_order}
            </Text>
            {node.path && <Text className="admin-meta">{node.path}</Text>}
            <View className="admin-actions">
              <Button
                variant="secondary"
                size="sm"
                disabled={busy || loading}
                onClick={() => setEditor({ id: node.id, editable: false })}
              >
                详情
              </Button>
              {canUpdate && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy || loading}
                  onClick={() => setEditor({ id: node.id, editable: true })}
                >
                  编辑
                </Button>
              )}
              {canCreate && node.type !== 2 && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy || loading}
                  onClick={() => setEditor({ parentId: node.id, editable: true })}
                >
                  添加下级
                </Button>
              )}
              {canUpdate && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy || loading}
                  onClick={() =>
                    void mutate(["system:menu:update"], () =>
                      updateAdminMenu(node.id, { status: node.status === "1" ? "0" : "1" }),
                    )
                  }
                >
                  {node.status === "1" ? "禁用" : "启用"}
                </Button>
              )}
              {canDelete && !node.children?.length && (
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy || loading}
                  onClick={() =>
                    void mutate(
                      ["system:menu:delete"],
                      () => deleteAdminMenu(node.id),
                      `确定删除菜单“${node.name}”？`,
                    )
                  }
                >
                  删除
                </Button>
              )}
            </View>
          </View>
          {children}
        </View>
      );
    });
  }
  return (
    <AdminPage
      title="菜单管理"
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
          {guard.denied ? "无权访问菜单管理" : guard.accessError || "正在验证访问权限"}
        </AdminNotice>
      ) : editor ? (
        <MenuEditor
          key={`${editor.id ?? `new-${editor.parentId || 0}`}:${getSessionVersion()}`}
          {...editor}
          tree={tree}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            setRetry((value) => value + 1);
          }}
        />
      ) : (
        <>
          <View className="admin-card">
            <FormField type="input" label="搜索菜单" value={keyword} onChange={setKeyword} />
          </View>
          {error && (
            <AdminNotice>
              {error}
              <Button variant="text" onClick={() => setRetry((value) => value + 1)}>
                重试
              </Button>
            </AdminNotice>
          )}
          {loading ? <AdminNotice>加载中…</AdminNotice> : renderNodes(tree)}
          {!loading && !tree.length && !error && <AdminNotice>暂无菜单</AdminNotice>}
        </>
      )}
    </AdminPage>
  );
}

export default withAccountScope(MenuPage)
