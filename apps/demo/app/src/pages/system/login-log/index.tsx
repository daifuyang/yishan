import { useEffect, useState } from "react";
import { Picker, Text, View } from "@tarojs/components";
import { Button } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { StateView } from "@/components/feedback";
import { PageContainer } from "@/components/layout";
import { useRequireAuth } from "@/utils/auth-guard";
import { useListPagination } from "@/hooks";
import { useAuthStore } from "@/stores/auth";
import { listAdminLoginLogs, getAdminLoginLog } from "@/api/admin/loginLog";
import type { AdminLoginLog } from "@/api/admin/types";
import { AdminPage, AdminSelect, AdminNotice, errorMessage } from "../_shared/AdminUI";
import { loginLogTimeRange } from "./query";

export default function LoginLogPage() {
  const guard = useRequireAuth({ moduleId: "system-login-log" });
  const identity = useAuthStore((state) => state.user?.id);
  if (!guard.ready || !guard.allowed) return <PageContainer>{null}</PageContainer>;
  return <LoginLogs key={identity} enabled={guard.ready && guard.allowed} />;
}

function LoginLogs({ enabled }: { enabled: boolean }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [dateError, setDateError] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const list = useListPagination<AdminLoginLog>({
    enabled,
    fetcher: async ({ page, pageSize, keyword, filters }) => {
      const response = await listAdminLoginLogs({
        page,
        pageSize,
        keyword: keyword || undefined,
        status: filters.status === "0" || filters.status === "1" ? filters.status : undefined,
        startTime: typeof filters.startTime === "string" ? filters.startTime : undefined,
        endTime: typeof filters.endTime === "string" ? filters.endTime : undefined,
        sortBy: "createdAt",
        sortOrder: "desc",
      });
      return { list: response.data, total: response.pagination.total };
    },
  });
  const applyDates = () => {
    try {
      list.setFilters(loginLogTimeRange(start, end));
      setDateError("");
      setDetailId(null);
    } catch (cause) {
      setDateError(errorMessage(cause));
    }
  };
  const clear = () => {
    setStart("");
    setEnd("");
    setDateError("");
    list.setFilters({ startTime: undefined, endTime: undefined });
  };
  return (
    <AdminPage title="登录日志">
      <View className="admin-card">
        <FormField
          type="input"
          label="搜索"
          placeholder="账号、姓名、IP、提示信息"
          value={list.keyword}
          onInput={list.setKeyword}
        />
        <AdminSelect
          label="登录状态"
          value={String(list.filters.status || "")}
          options={[
            { label: "全部", value: "" },
            { label: "成功", value: "1" },
            { label: "失败", value: "0" },
          ]}
          onChange={(status) => list.setFilters({ status })}
        />
        <Picker mode="date" value={start} onChange={(event) => setStart(event.detail.value)}>
          <FormField type="picker" label="开始日期" value={start} placeholder="不限" />
        </Picker>
        <Picker mode="date" value={end} onChange={(event) => setEnd(event.detail.value)}>
          <FormField type="picker" label="结束日期" value={end} placeholder="不限" />
        </Picker>
        {dateError && <AdminNotice>{dateError}</AdminNotice>}
        <View className="admin-actions">
          <Button size="sm" onClick={applyDates}>
            应用日期
          </Button>
          <Button size="sm" variant="secondary" onClick={clear}>
            清除日期
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={list.refreshing}
            onClick={() => list.refresh()}
          >
            刷新
          </Button>
        </View>
      </View>
      {detailId && (
        <LoginLogDetail key={detailId} id={detailId} onClose={() => setDetailId(null)} />
      )}
      <AdminNotice>共 {list.total} 条记录 · 按时间倒序</AdminNotice>
      {list.error && <StateView kind="error" text={list.error} onRetry={list.refresh} />}
      {list.loading && list.list.length === 0 && <StateView kind="loading" />}
      {!list.loading && !list.error && list.list.length === 0 && (
        <StateView kind="empty" text="暂无登录日志" />
      )}
      {list.list.map((record) => (
        <View className="admin-card" key={record.id}>
          <Text className="admin-name">
            {record.username} · {record.status === "1" ? "成功" : "失败"}
          </Text>
          <Text className="admin-meta">
            {record.realName || "-"} · {record.ipAddress || "-"}
          </Text>
          <Text className="admin-meta">{record.message || "无提示信息"}</Text>
          <Text className="admin-meta">{record.createdAt}</Text>
          <View className="admin-actions">
            <Button size="sm" variant="secondary" onClick={() => setDetailId(record.id)}>
              查看详情
            </Button>
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

function LoginLogDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const [record, setRecord] = useState<AdminLoginLog | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let current = true;
    setError("");
    getAdminLoginLog(id)
      .then((data) => {
        if (current) setRecord(data);
      })
      .catch((cause) => {
        if (current) setError(errorMessage(cause));
      });
    return () => {
      current = false;
    };
  }, [id, reload]);
  return (
    <View className="admin-card">
      <Text className="admin-section-title">登录详情</Text>
      {error && (
        <StateView kind="error" text={error} onRetry={() => setReload((value) => value + 1)} />
      )}
      {!record && !error && <StateView kind="loading" />}
      {record && (
        <>
          <Text className="admin-name">
            {record.username} · {record.status === "1" ? "成功" : "失败"}
          </Text>
          <Text className="admin-meta">
            日志 ID：{record.id} · 用户 ID：{record.userId || "-"}
          </Text>
          <Text className="admin-meta">姓名：{record.realName || "-"}</Text>
          <Text className="admin-meta">提示：{record.message || "-"}</Text>
          <Text className="admin-meta">IP：{record.ipAddress || "-"}</Text>
          <Text className="admin-meta">User-Agent：{record.userAgent || "-"}</Text>
          <Text className="admin-meta">创建：{record.createdAt}</Text>
          <Text className="admin-meta">更新：{record.updatedAt}</Text>
        </>
      )}
      <View className="admin-actions">
        <Button size="sm" variant="secondary" onClick={onClose}>
          关闭详情
        </Button>
      </View>
    </View>
  );
}
