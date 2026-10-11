import { withAccountScope } from '../_shared/AdminUI'
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useRef, useState } from "react";
import { deleteAdminPosition, listAdminPositions, updateAdminPosition } from "@/api/admin/position";
import { getSessionVersion } from "@/api/client";
import { Button } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { confirmAction, useCanWrite, useListPagination } from "@/hooks";
import { canWriteModuleNow, useRequireAuth } from "@/utils/auth-guard";
import { AdminNotice, AdminPage, AdminSelect, errorMessage } from "../_shared/AdminUI";
import { PositionEditor } from "./PositionEditor";

function PositionPage() {
  const guard = useRequireAuth({ moduleId: "system-position" });
  const allowed = guard.ready && guard.allowed;
  const canCreate = useCanWrite("system:position:create");
  const canUpdate = useCanWrite("system:position:update");
  const canDelete = useCanWrite("system:position:delete");
  const [editor, setEditor] = useState<{ id?: number; editable: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const list = useListPagination({
    enabled: allowed,
    fetcher: async ({ page, pageSize, keyword, filters }) => {
      const result = await listAdminPositions({
        page,
        pageSize,
        keyword,
        status: filters.status === "1" || filters.status === "0" ? filters.status : undefined,
      });
      return { list: result.data, total: result.pagination.total };
    },
  });
  async function mutate(required: string[], operation: () => Promise<unknown>, confirm?: string) {
    if (!mounted.current || locked.current || !canWriteModuleNow("system-position", required))
      return;
    const session = getSessionVersion();
    locked.current = true;
    setBusy(true);
    try {
      if (confirm && !(await confirmAction({ content: confirm }))) return;
      if (
        !mounted.current ||
        session !== getSessionVersion() ||
        !canWriteModuleNow("system-position", required)
      )
        return;
      await operation();
      if (
        !mounted.current ||
        session !== getSessionVersion() ||
        !canWriteModuleNow("system-position", required)
      )
        return;
      void Taro.showToast({ title: "操作成功", icon: "success" });
      await list.refresh();
    } catch (error) {
      if (
        mounted.current &&
        session === getSessionVersion() &&
        canWriteModuleNow("system-position", required)
      )
        void Taro.showToast({ title: errorMessage(error), icon: "none" });
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <AdminPage
      title="岗位管理"
      action={
        allowed && canCreate && !editor ? (
          <Button size="sm" disabled={busy} onClick={() => setEditor({ editable: true })}>
            新建
          </Button>
        ) : undefined
      }
    >
      {!allowed ? (
        <AdminNotice>
          {guard.denied ? "无权访问岗位管理" : guard.accessError || "正在验证访问权限"}
        </AdminNotice>
      ) : editor ? (
        <PositionEditor
          key={`${editor.id ?? "new"}:${getSessionVersion()}`}
          id={editor.id}
          editable={editor.editable}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            void list.refresh();
          }}
        />
      ) : (
        <>
          <View className="admin-card">
            <FormField
              type="input"
              label="搜索岗位"
              value={list.keyword}
              onChange={list.setKeyword}
            />
            <AdminSelect
              label="状态"
              value={String(list.filters.status || "")}
              options={[
                { label: "全部", value: "" },
                { label: "启用", value: "1" },
                { label: "禁用", value: "0" },
              ]}
              onChange={(status) => list.setFilters({ status })}
            />
          </View>
          {list.error && (
            <AdminNotice>
              {list.error}
              <Button variant="text" onClick={() => void list.refresh()}>
                重试
              </Button>
            </AdminNotice>
          )}
          {list.list.map((position) => (
            <View className="admin-card" key={position.id}>
              <Text className="admin-name">{position.name}</Text>
              <Text className="admin-meta">
                {position.status === "1" ? "启用" : "禁用"} · 排序 {position.sort_order}
              </Text>
              <Text className="admin-meta">{position.description || "暂无描述"}</Text>
              <View className="admin-actions">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => setEditor({ id: position.id, editable: false })}
                >
                  详情
                </Button>
                {canUpdate && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => setEditor({ id: position.id, editable: true })}
                  >
                    编辑
                  </Button>
                )}
                {canUpdate && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void mutate(["system:position:update"], () =>
                        updateAdminPosition(position.id, {
                          status: position.status === "1" ? "0" : "1",
                        }),
                      )
                    }
                  >
                    {position.status === "1" ? "禁用" : "启用"}
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void mutate(
                        ["system:position:delete"],
                        () => deleteAdminPosition(position.id),
                        `确定删除岗位“${position.name}”？`,
                      )
                    }
                  >
                    删除
                  </Button>
                )}
              </View>
            </View>
          ))}
          <AdminNotice>{list.loading ? "加载中…" : `共 ${list.total} 个岗位`}</AdminNotice>
          {!list.loading && !list.finished && (
            <Button block variant="secondary" onClick={() => void list.loadMore()}>
              加载更多
            </Button>
          )}
          {!list.loading && !list.error && list.list.length === 0 && (
            <AdminNotice>暂无岗位</AdminNotice>
          )}
        </>
      )}
    </AdminPage>
  );
}

export default withAccountScope(PositionPage)
