import { useEffect, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Button } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { useCanWrite } from "@/hooks";
import type { AdminDept } from "@/api/admin/types";
import * as api from "@/api/admin/dept";
import { AdminSelect, AdminNotice, errorMessage } from "../_shared/AdminUI";
import { departmentParentOptions, departmentPayload, type DepartmentFormValues } from "./form";
import { useCurrentModuleAccess } from "@/utils/auth-guard";

export default function DepartmentForm({
  department,
  parentId = 0,
  onCancel,
  onSuccess,
}: {
  department?: AdminDept;
  parentId?: number;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const canSave = useCanWrite(department ? "system:department:update" : "system:department:create");
  const isCurrent = useCurrentModuleAccess('system-dept');
  const required = [department ? 'system:department:update' : 'system:department:create'];
  const canList = useCanWrite("system:department:list");
  const [values, setValues] = useState<DepartmentFormValues>({
    name: department?.name || "",
    parentId: String(department?.parentId || parentId),
    status: department?.status || "1",
    sort: String(department?.sort_order || 0),
    description: department?.description || "",
    leaderId: department?.leaderId ? String(department.leaderId) : "",
  });
  const [tree, setTree] = useState<AdminDept[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
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
    if (!canList) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    Promise.all([
      api.getAdminDeptTree(),
      department ? api.getAdminDept(department.id) : Promise.resolve(undefined),
    ])
      .then(([nodes, detail]) => {
        if (!current) return;
        setTree(nodes);
        if (detail)
          setValues({
            name: detail.name,
            parentId: String(detail.parentId || 0),
            status: detail.status,
            sort: String(detail.sort_order),
            description: detail.description || "",
            leaderId: detail.leaderId ? String(detail.leaderId) : "",
          });
      })
      .catch((cause) => {
        if (current) setLoadError(errorMessage(cause));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [department?.id, canList, reload]);
  const field = (name: keyof DepartmentFormValues, value: string) =>
    setValues((previous) => ({ ...previous, [name]: value }));
  const save = async () => {
    if (!canSave || !isCurrent(required) || lock.current || loading || loadError) return;
    lock.current = true;
    setSaving(true);
    setError("");
    try {
      const payload = departmentPayload(values);
      if (department?.parentId && values.parentId === "0") throw new Error("请选择上级部门");
      if (department) await api.updateAdminDept(department.id, payload);
      else await api.createAdminDept(payload);
      if (!alive.current || !isCurrent(required)) return;
      await Taro.showToast({ title: "保存成功", icon: "success" });
      if (isCurrent(required)) onSuccess();
    } catch (cause) {
      if (alive.current && isCurrent(required)) setError(errorMessage(cause));
    } finally {
      lock.current = false;
      if (alive.current) setSaving(false);
    }
  };
  return (
    <View className="admin-card">
      <Text className="admin-section-title">{department ? "编辑部门" : "新建部门"}</Text>
      {loading && <AdminNotice>加载部门信息…</AdminNotice>}
      <AdminSelect
        label="上级部门"
        value={values.parentId}
        options={departmentParentOptions(tree, department?.id).filter(
          (option) => !department?.parentId || option.value !== "0",
        )}
        disabled={loading || saving}
        onChange={(value) => field("parentId", value)}
      />
      <FormField
        type="input"
        label="部门名称"
        required
        value={values.name}
        maxLength={100}
        disabled={loading || saving}
        onInput={(value) => field("name", value)}
      />
      <AdminSelect
        label="状态"
        value={values.status}
        options={[
          { label: "启用", value: "1" },
          { label: "禁用", value: "0" },
        ]}
        disabled={saving}
        onChange={(value) => field("status", value)}
      />
      <FormField
        type="input"
        label="排序"
        inputType="number"
        value={values.sort}
        disabled={saving}
        onInput={(value) => field("sort", value)}
      />
      <FormField
        type="input"
        label="负责人用户 ID"
        inputType="number"
        value={values.leaderId}
        hint={
          department?.leaderId
            ? `当前负责人：${department.leaderName || department.leaderId}；留空保留原负责人`
            : "可选"
        }
        disabled={saving}
        onInput={(value) => field("leaderId", value)}
      />
      <FormField
        type="textarea"
        label="部门描述"
        value={values.description}
        maxLength={255}
        disabled={saving}
        onInput={(value) => field("description", value)}
      />
      {error && <AdminNotice>{error}</AdminNotice>}
      {loadError && <AdminNotice>{loadError}</AdminNotice>}
      <View className="admin-actions">
        <Button
          loading={saving}
          disabled={loading || !canSave || Boolean(loadError)}
          onClick={save}
        >
          保存
        </Button>
        <Button variant="secondary" disabled={saving} onClick={onCancel}>
          取消
        </Button>
        {loadError && (
          <Button
            variant="secondary"
            disabled={saving}
            onClick={() => setReload((count) => count + 1)}
          >
            重新加载
          </Button>
        )}
      </View>
    </View>
  );
}
