import { useEffect, useState } from "react";
import { View, Text } from "@tarojs/components";
import { useRouter } from "@tarojs/taro";
import { Button } from "@/components/atoms";
import { StateView } from "@/components/feedback";
import { PageContainer } from "@/components/layout";
import { useRequireAuth } from "@/utils/auth-guard";
import { useCanWrite, useListPagination } from "@/hooks";
import { useAuthStore } from "@/stores/auth";
import { navigateTo } from "@/utils/router";
import { SYSTEM_PAGES } from "@/constants/routes";
import { getAdminDept, listAdminDepts } from "@/api/admin/dept";
import { getDeptUsers } from "@/api/contacts";
import type { AdminDept } from "@/api/admin/types";
import type { DeptUser } from "@/api/types";
import { AdminPage, AdminNotice, errorMessage } from "../../_shared/AdminUI";
import DepartmentForm from "../DepartmentForm";

export default function DeptDetailPage() {
  const guard = useRequireAuth({ moduleId: "system-dept" });
  const id = Number(useRouter().params.id);
  const identity = useAuthStore((state) => state.user?.id);
  if (!guard.ready || !guard.allowed) return <PageContainer>{null}</PageContainer>;
  if (!Number.isInteger(id) || id < 1)
    return (
      <AdminPage title="部门详情">
        <AdminNotice>部门参数无效</AdminNotice>
      </AdminPage>
    );
  return (
    <DepartmentDetail key={`${identity}:${id}`} id={id} enabled={guard.ready && guard.allowed} />
  );
}

function DepartmentDetail({ id, enabled }: { id: number; enabled: boolean }) {
  const canUpdate = useCanWrite("system:department:update");
  const canCreate = useCanWrite("system:department:create");
  const canMembers = useCanWrite("app:contacts:dept-users");
  const [department, setDepartment] = useState<AdminDept | null>(null);
  const [members, setMembers] = useState<DeptUser[]>([]);
  const [memberError, setMemberError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("info");
  const [editing, setEditing] = useState<"edit" | "new" | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let current = true;
    if (!enabled) return;
    setLoading(true);
    setError("");
    getAdminDept(id)
      .then((data) => {
        if (current) setDepartment(data);
      })
      .catch((cause) => {
        if (current) setError(errorMessage(cause));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [id, enabled, reload]);
  useEffect(() => {
    let current = true;
    setMembers([]);
    setMemberError("");
    if (!enabled || !canMembers) return;
    getDeptUsers(id)
      .then((data) => {
        if (current) setMembers(data);
      })
      .catch((cause) => {
        if (current) setMemberError(errorMessage(cause));
      });
    return () => {
      current = false;
    };
  }, [id, enabled, canMembers, reload]);
  const children = useListPagination<AdminDept>({
    enabled,
    fetcher: async ({ page, pageSize }) => {
      const { data, pagination } = await listAdminDepts({ parentId: id, page, pageSize });
      return { list: data, total: pagination.total };
    },
  });
  const refresh = () => {
    setReload((value) => value + 1);
    void children.refresh();
  };
  return (
    <AdminPage
      title={department?.name || "部门详情"}
      action={
        <Button size="sm" variant="secondary" onClick={refresh}>
          刷新
        </Button>
      }
    >
      {loading && <StateView kind="loading" />}
      {error && <StateView kind="error" text={error} onRetry={refresh} />}
      {department && (
        <>
          <View className="admin-actions">
            {[
              { value: "info", label: "基本信息" },
              { value: "members", label: "部门成员" },
              { value: "children", label: "子部门" },
            ].map((item) => (
              <Button
                key={item.value}
                size="sm"
                variant={tab === item.value ? "primary" : "secondary"}
                onClick={() => setTab(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </View>
          {editing && (
            <DepartmentForm
              key={editing}
              department={editing === "edit" ? department : undefined}
              parentId={editing === "new" ? id : undefined}
              onCancel={() => setEditing(null)}
              onSuccess={() => {
                setEditing(null);
                refresh();
              }}
            />
          )}
          {tab === "info" && (
            <View className="admin-card">
              <Text className="admin-name">{department.name}</Text>
              <Text className="admin-meta">
                ID：{department.id} · {department.status === "1" ? "启用" : "禁用"}
              </Text>
              <Text className="admin-meta">上级部门：{department.parentName || "顶级部门"}</Text>
              <Text className="admin-meta">
                负责人：{department.leaderName || department.leaderId || "未设置"}
              </Text>
              <Text className="admin-meta">排序：{department.sort_order}</Text>
              <Text className="admin-meta">描述：{department.description || "无"}</Text>
              <Text className="admin-meta">
                创建：{department.createdAt} · {department.creatorName || "-"}
              </Text>
              <Text className="admin-meta">
                更新：{department.updatedAt} · {department.updaterName || "-"}
              </Text>
              <View className="admin-actions">
                {canUpdate && (
                  <Button size="sm" onClick={() => setEditing("edit")}>
                    编辑部门
                  </Button>
                )}
                {canCreate && (
                  <Button size="sm" variant="secondary" onClick={() => setEditing("new")}>
                    新建子部门
                  </Button>
                )}
              </View>
            </View>
          )}
          {tab === "members" && (
            <View className="admin-card">
              {!canMembers && <AdminNotice>暂无查看部门成员的权限</AdminNotice>}
              {memberError && <StateView kind="error" text={memberError} onRetry={refresh} />}
              {canMembers && !memberError && members.length === 0 && (
                <AdminNotice>暂无启用成员</AdminNotice>
              )}
              {members.map((member) => (
                <View key={member.id} className="admin-row">
                  <View>
                    <Text className="admin-name">
                      {member.realName || member.username || member.phone}
                    </Text>
                    <Text className="admin-meta">
                      ID：{member.id} · {member.phone || "-"} · {member.email || "-"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          {tab === "children" && (
            <>
              <AdminNotice>共 {children.total} 个子部门</AdminNotice>
              {children.error && (
                <StateView kind="error" text={children.error} onRetry={children.refresh} />
              )}
              {children.loading && <StateView kind="loading" />}
              {!children.loading && !children.error && children.list.length === 0 && (
                <StateView kind="empty" text="暂无子部门" />
              )}
              {children.list.map((child) => (
                <View
                  className="admin-card"
                  key={child.id}
                  onClick={() => navigateTo(`/${SYSTEM_PAGES.deptDetail}?id=${child.id}`)}
                >
                  <Text className="admin-name">{child.name} ›</Text>
                  <Text className="admin-meta">
                    {child.status === "1" ? "启用" : "禁用"} · 负责人：
                    {child.leaderName || child.leaderId || "未设置"}
                  </Text>
                </View>
              ))}
              {!children.finished && (
                <Button
                  variant="secondary"
                  loading={children.loadingMore}
                  disabled={children.loading}
                  onClick={() => children.loadMore()}
                >
                  加载更多
                </Button>
              )}
            </>
          )}
        </>
      )}
    </AdminPage>
  );
}
