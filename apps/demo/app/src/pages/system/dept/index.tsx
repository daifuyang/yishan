import { View, Text } from "@tarojs/components";
import { useEffect, useRef, useState } from "react";
import Taro from "@tarojs/taro";
import { Button } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { StateView } from "@/components/feedback";
import { PageContainer } from "@/components/layout";
import { useCanWrite, useListPagination, confirmAction } from "@/hooks";
import { canWriteModuleNow, useRequireAuth } from "@/utils/auth-guard";
import { getSessionVersion } from "@/api/client";
import { navigateTo } from "@/utils/router";
import { useAuthStore } from "@/stores/auth";
import { SYSTEM_PAGES } from "@/constants/routes";
import * as api from "@/api/admin/dept";
import type { AdminDept } from "@/api/admin/types";
import { AdminPage, AdminSelect, AdminNotice, errorMessage } from "../_shared/AdminUI";
import DepartmentForm from "./DepartmentForm";

export default function DeptIndexPage() {
  const guard = useRequireAuth({ moduleId: "system-dept" });
  const identity = useAuthStore((state) => state.user?.id);
  if (!guard.ready || !guard.allowed) return <PageContainer>{null}</PageContainer>;
  return <DepartmentList key={identity} enabled={guard.ready && guard.allowed} />;
}

function DepartmentList({ enabled }: { enabled: boolean }) {
  const canCreate = useCanWrite("system:department:create");
  const canUpdate = useCanWrite("system:department:update");
  const canDelete = useCanWrite("system:department:delete");
  const [editing, setEditing] = useState<AdminDept | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const list = useListPagination<AdminDept>({
    enabled,
    fetcher: async ({ page, pageSize, keyword, filters }) => {
      const { data, pagination } = await api.listAdminDepts({
        page,
        pageSize,
        keyword: keyword || undefined,
        status: filters.status === "0" || filters.status === "1" ? filters.status : undefined,
      });
      return { list: data, total: pagination.total };
    },
  });
  const mutate = async (dept: AdminDept, remove: boolean) => {
    if (lock.current || !(remove ? canDelete : canUpdate)) return;
    lock.current = true;
    const version = getSessionVersion();
    const current = () => alive.current && version === getSessionVersion() && canWriteModuleNow('system-dept', [remove ? 'system:department:delete' : 'system:department:update']);
    setBusy(true);
    try {
      if (
        remove &&
        !(await confirmAction({
          title: "删除部门",
          content: `确认删除「${dept.name}」？有子部门的部门不能删除。`,
        }))
      )
        return;
      if (!current()) return;
      if (remove) await api.deleteAdminDept(dept.id);
      else await api.updateAdminDept(dept.id, { status: dept.status === "1" ? "0" : "1" });
      if (!current()) return;
      await Taro.showToast({ title: "操作成功", icon: "success" });
      await list.refresh();
    } catch (cause) {
      if (alive.current) await Taro.showToast({ title: errorMessage(cause), icon: "none" });
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return (
    <AdminPage
      title="部门管理"
      action={
        canCreate && (
          <Button size="sm" disabled={busy} onClick={() => setEditing("new")}>
            新建
          </Button>
        )
      }
    >
      <View className="admin-card">
        <FormField
          type="input"
          label="搜索部门"
          placeholder="名称、描述"
          value={list.keyword}
          onInput={list.setKeyword}
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
        <Button
          size="sm"
          variant="secondary"
          loading={list.refreshing}
          onClick={() => list.refresh()}
        >
          刷新
        </Button>
      </View>
      {editing && (
        <DepartmentForm
          key={editing === "new" ? "new" : editing.id}
          department={editing === "new" ? undefined : editing}
          onCancel={() => setEditing(null)}
          onSuccess={() => {
            setEditing(null);
            void list.refresh();
          }}
        />
      )}
      <AdminNotice>共 {list.total} 个部门</AdminNotice>
      {list.error && <StateView kind="error" text={list.error} onRetry={list.refresh} />}
      {list.loading && list.list.length === 0 && <StateView kind="loading" />}
      {!list.loading && !list.error && list.list.length === 0 && (
        <StateView kind="empty" text="暂无部门" />
      )}
      {list.list.map((dept) => (
        <View className="admin-card" key={dept.id}>
          <Text
            className="admin-name"
            onClick={() => navigateTo(`/${SYSTEM_PAGES.deptDetail}?id=${dept.id}`)}
          >
            {dept.name} ›
          </Text>
          <Text className="admin-meta">
            {dept.status === "1" ? "启用" : "禁用"} · 上级：{dept.parentName || "顶级部门"} · 排序：
            {dept.sort_order}
          </Text>
          <Text className="admin-meta">负责人：{dept.leaderName || dept.leaderId || "未设置"}</Text>
          <View className="admin-actions">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigateTo(`/${SYSTEM_PAGES.deptDetail}?id=${dept.id}`)}
            >
              详情
            </Button>
            {canUpdate && (
              <Button
                size="sm"
                disabled={busy}
                variant="secondary"
                onClick={() => setEditing(dept)}
              >
                编辑
              </Button>
            )}
            {canUpdate && (
              <Button
                size="sm"
                disabled={busy}
                variant="secondary"
                onClick={() => mutate(dept, false)}
              >
                {dept.status === "1" ? "禁用" : "启用"}
              </Button>
            )}
            {canDelete && (
              <Button size="sm" disabled={busy} variant="danger" onClick={() => mutate(dept, true)}>
                删除
              </Button>
            )}
          </View>
        </View>
      ))}
      {!list.finished && (
        <Button
          variant="secondary"
          loading={list.loadingMore}
          disabled={list.loading}
          onClick={() => list.loadMore()}
        >
          加载更多
        </Button>
      )}
    </AdminPage>
  );
}
