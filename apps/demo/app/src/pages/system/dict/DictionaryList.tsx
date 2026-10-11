import { useEffect, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Button } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { StateView } from "@/components/feedback";
import { useCanWrite, useListPagination, confirmAction } from "@/hooks";
import { navigateTo } from "@/utils/router";
import { SYSTEM_PAGES } from "@/constants/routes";
import * as api from "@/api/admin/dict";
import type { AdminDictType, AdminDictData } from "@/api/admin/types";
import { AdminPage, AdminSelect, AdminNotice, errorMessage } from "../_shared/AdminUI";
import DictionaryForm from "./DictionaryForm";
import { canWriteModuleNow } from "@/utils/auth-guard";
import { getSessionVersion } from "@/api/client";

export default function DictionaryList({ enabled, typeId }: { enabled: boolean; typeId?: number }) {
  const canCreate = useCanWrite("system:dict:create");
  const canUpdate = useCanWrite("system:dict:update");
  const canDelete = useCanWrite("system:dict:delete");
  const [editing, setEditing] = useState<AdminDictType | AdminDictData | "new" | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [context, setContext] = useState<AdminDictType | null>(null);
  const [contextError, setContextError] = useState("");
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let current = true;
    if (!enabled || !typeId) return;
    setContextError("");
    api
      .getAdminDictType(typeId)
      .then((data) => {
        if (current) setContext(data);
      })
      .catch((cause) => {
        if (current) setContextError(errorMessage(cause));
      });
    return () => {
      current = false;
    };
  }, [typeId, enabled, reload]);
  const list = useListPagination<AdminDictType | AdminDictData>({
    enabled,
    fetcher: async ({ page, pageSize, keyword, filters }) => {
      const query = {
        page,
        pageSize,
        keyword: keyword || undefined,
        status:
          filters.status === "0" ? (0 as const) : filters.status === "1" ? (1 as const) : undefined,
      };
      const response = typeId
        ? await api.listAdminDictData({ ...query, typeId })
        : await api.listAdminDictTypes(query);
      return { list: response.data, total: response.pagination.total };
    },
  });
  const mutate = async (
    record: AdminDictType | AdminDictData,
    operation: "delete" | "status" | "default",
  ) => {
    if (lock.current || !(operation === "delete" ? canDelete : canUpdate)) return;
    lock.current = true;
    const version = getSessionVersion();
    const current = () => alive.current && version === getSessionVersion() && canWriteModuleNow('system-dict', [operation === 'delete' ? 'system:dict:delete' : 'system:dict:update']);
    setBusy(true);
    try {
      if (
        operation === "delete" &&
        !(await confirmAction({
          title: typeId ? "删除字典项" : "删除字典类型",
          content: `确认删除「${"label" in record ? record.label : record.name}」？`,
        }))
      )
        return;
      if (!current()) return;
      if (operation === "delete") {
        if (typeId) await api.deleteAdminDictData(record.id);
        else await api.deleteAdminDictType(record.id);
      } else if (operation === "default" && "isDefault" in record)
        await api.updateAdminDictData(record.id, { isDefault: !record.isDefault });
      else if (typeId)
        await api.updateAdminDictData(record.id, { status: record.status === 1 ? 0 : 1 });
      else await api.updateAdminDictType(record.id, { status: record.status === 1 ? 0 : 1 });
      if (!current()) return;
      await Taro.showToast({ title: "操作成功", icon: "success" });
      setDetailId(null);
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
      title={typeId ? context?.name || "字典项" : "字典管理"}
      action={
        canCreate && (
          <Button
            size="sm"
            disabled={busy || Boolean(typeId && !context)}
            onClick={() => setEditing("new")}
          >
            新建
          </Button>
        )
      }
    >
      {contextError && (
        <StateView
          kind="error"
          text={contextError}
          onRetry={() => setReload((value) => value + 1)}
        />
      )}
      {context && (
        <View className="admin-card">
          <Text className="admin-name">{context.name}</Text>
          <Text className="admin-meta">
            {context.type} · {context.status === 1 ? "正常" : "停用"}
          </Text>
          <Text className="admin-meta">{context.remark || "无备注"}</Text>
        </View>
      )}
      <View className="admin-card">
        <FormField
          type="input"
          label="搜索"
          placeholder={typeId ? "标签、键值" : "名称、类型"}
          value={list.keyword}
          onInput={list.setKeyword}
        />
        <AdminSelect
          label="状态"
          value={String(list.filters.status || "")}
          options={[
            { label: "全部", value: "" },
            { label: "正常", value: "1" },
            { label: "停用", value: "0" },
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
      {editing &&
        (typeId ? (
          <DictionaryForm
            key={editing === "new" ? "new" : editing.id}
            typeId={typeId}
            record={editing !== "new" && "label" in editing ? editing : undefined}
            onCancel={() => setEditing(null)}
            onSuccess={() => {
              setEditing(null);
              void list.refresh();
            }}
          />
        ) : (
          <DictionaryForm
            key={editing === "new" ? "new" : editing.id}
            record={editing !== "new" && "name" in editing ? editing : undefined}
            onCancel={() => setEditing(null)}
            onSuccess={() => {
              setEditing(null);
              void list.refresh();
            }}
          />
        ))}
      {detailId && (
        <DictionaryDetail
          key={detailId}
          id={detailId}
          item={Boolean(typeId)}
          onClose={() => setDetailId(null)}
        />
      )}
      <AdminNotice>
        共 {list.total} {typeId ? "个字典项" : "个字典类型"}
      </AdminNotice>
      {list.error && <StateView kind="error" text={list.error} onRetry={list.refresh} />}
      {list.loading && list.list.length === 0 && <StateView kind="loading" />}
      {!list.loading && !list.error && list.list.length === 0 && (
        <StateView kind="empty" text="暂无数据" />
      )}
      {list.list.map((record) => (
        <View className="admin-card" key={record.id}>
          <Text className="admin-name">{"label" in record ? record.label : record.name}</Text>
          <Text className="admin-meta">
            {"value" in record ? `键值：${record.value}` : `类型：${record.type}`} ·{" "}
            {record.status === 1 ? "正常" : "停用"} · 排序：{record.sort_order}
          </Text>
          {"isDefault" in record && (
            <Text className="admin-meta">
              {record.isDefault ? "默认值" : "非默认"} · 样式：{record.tag || "无"}
            </Text>
          )}
          <Text className="admin-meta">{record.remark || "无备注"}</Text>
          <View className="admin-actions">
            <Button size="sm" variant="secondary" onClick={() => setDetailId(record.id)}>
              详情
            </Button>
            {!typeId && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigateTo(`/${SYSTEM_PAGES.dictItems}?typeId=${record.id}`)}
              >
                字典项
              </Button>
            )}
            {canUpdate && (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => setEditing(record)}
              >
                编辑
              </Button>
            )}
            {canUpdate && (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => mutate(record, "status")}
              >
                {record.status === 1 ? "停用" : "启用"}
              </Button>
            )}
            {canUpdate && "isDefault" in record && (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => mutate(record, "default")}
              >
                {record.isDefault ? "取消默认" : "设为默认"}
              </Button>
            )}
            {canDelete && (
              <Button
                size="sm"
                variant="danger"
                disabled={busy}
                onClick={() => mutate(record, "delete")}
              >
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

function DictionaryDetail({
  id,
  item,
  onClose,
}: {
  id: number;
  item: boolean;
  onClose: () => void;
}) {
  const [record, setRecord] = useState<AdminDictType | AdminDictData | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let current = true;
    setError("");
    const request = item ? api.getAdminDictData(id) : api.getAdminDictType(id);
    request
      .then((data) => {
        if (current) setRecord(data);
      })
      .catch((cause) => {
        if (current) setError(errorMessage(cause));
      });
    return () => {
      current = false;
    };
  }, [id, item, reload]);
  return (
    <View className="admin-card">
      <Text className="admin-section-title">字典详情</Text>
      {error && (
        <StateView kind="error" text={error} onRetry={() => setReload((value) => value + 1)} />
      )}
      {!error && !record && <StateView kind="loading" />}
      {record && (
        <>
          <Text className="admin-name">{"label" in record ? record.label : record.name}</Text>
          <Text className="admin-meta">
            ID：{record.id} · 类型：{record.type}
          </Text>
          {"value" in record && (
            <Text className="admin-meta">
              键值：{record.value} · {record.isDefault ? "默认" : "非默认"} · 样式：
              {record.tag || "-"}
            </Text>
          )}
          <Text className="admin-meta">
            {record.status === 1 ? "正常" : "停用"} · 排序：{record.sort_order}
          </Text>
          <Text className="admin-meta">备注：{record.remark || "无"}</Text>
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
