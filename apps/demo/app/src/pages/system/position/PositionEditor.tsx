import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useRef, useState } from "react";
import {
  createAdminPosition,
  getAdminPosition,
  type SaveAdminPosition,
  updateAdminPosition,
} from "@/api/admin/position";
import { getSessionVersion } from "@/api/client";
import { Button } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { useCanWrite } from "@/hooks";
import { canWriteModuleNow } from "@/utils/auth-guard";
import { AdminNotice, AdminSelect, errorMessage } from "../_shared/AdminUI";

export function PositionEditor({
  id,
  editable,
  onClose,
  onSaved,
}: {
  id?: number;
  editable: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const canSave = useCanWrite(id ? "system:position:update" : "system:position:create");
  const [values, setValues] = useState<SaveAdminPosition>({
    name: "",
    description: "",
    status: "1",
    sort_order: 0,
  });
  const [sort, setSort] = useState("0");
  const [loading, setLoading] = useState(Boolean(id));
  const [loaded, setLoaded] = useState(!id);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const session = useRef(getSessionVersion()).current;
  const required = [id ? "system:position:update" : "system:position:create"];
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    if (id) {
      setLoading(true);
      setError("");
      getAdminPosition(id)
        .then((position) => {
          if (
            !active ||
            session !== getSessionVersion() ||
            !canWriteModuleNow("system-position", ["system:position:list"])
          )
            return;
          setValues({
            name: position.name,
            description: position.description || "",
            status: position.status,
            sort_order: position.sort_order,
          });
          setSort(String(position.sort_order));
          setLoaded(true);
        })
        .catch((cause) => {
          if (active && session === getSessionVersion()) setError(errorMessage(cause));
        })
        .finally(() => {
          if (active && session === getSessionVersion()) setLoading(false);
        });
    }
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [id, retry, session]);
  const disabled = !editable || !canSave || busy || loading || !loaded;
  async function save() {
    if (
      disabled ||
      locked.current ||
      session !== getSessionVersion() ||
      !canWriteModuleNow("system-position", required)
    )
      return;
    if (!values.name.trim()) {
      setError("请输入岗位名称");
      return;
    }
    if (!sort.trim() || !Number.isFinite(Number(sort)) || Number(sort) < 0) {
      setError("排序须为非负数字");
      return;
    }
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const payload = { ...values, name: values.name.trim(), sort_order: Number(sort) };
      if (id) await updateAdminPosition(id, payload);
      else await createAdminPosition(payload);
      if (
        mounted.current &&
        session === getSessionVersion() &&
        canWriteModuleNow("system-position", required)
      ) {
        void Taro.showToast({ title: "保存成功", icon: "success" });
        onSaved();
      }
    } catch (cause) {
      if (
        mounted.current &&
        session === getSessionVersion() &&
        canWriteModuleNow("system-position", required)
      )
        setError(errorMessage(cause));
    } finally {
      locked.current = false;
      if (
        mounted.current &&
        session === getSessionVersion() &&
        canWriteModuleNow("system-position", required)
      )
        setBusy(false);
    }
  }
  return (
    <View className="admin-card">
      <Text className="admin-section-title">
        {id ? (editable ? "编辑岗位" : "岗位详情") : "新建岗位"}
      </Text>
      {loading ? (
        <AdminNotice>加载中…</AdminNotice>
      ) : (
        <>
          <FormField
            type="input"
            label="岗位名称"
            required
            value={values.name}
            maxLength={100}
            disabled={disabled}
            onChange={(name) => setValues({ ...values, name })}
          />
          <AdminSelect
            label="状态"
            value={values.status || "1"}
            disabled={disabled}
            options={[
              { value: "1", label: "启用" },
              { value: "0", label: "禁用" },
            ]}
            onChange={(status) => setValues({ ...values, status: status === "1" ? "1" : "0" })}
          />
          <FormField
            type="input"
            label="排序"
            value={sort}
            inputType="digit"
            disabled={disabled}
            onChange={setSort}
          />
          <FormField
            type="textarea"
            label="岗位描述"
            value={values.description}
            maxLength={255}
            disabled={disabled}
            onInput={(description) => setValues({ ...values, description })}
          />
        </>
      )}
      {error && (
        <AdminNotice>
          {error}
          {id && !values.name && (
            <Button variant="text" onClick={() => setRetry(retry + 1)}>
              重新加载
            </Button>
          )}
        </AdminNotice>
      )}
      <View className="admin-actions">
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          关闭
        </Button>
        {editable && canSave && (
          <Button loading={busy} disabled={loading || !loaded} onClick={() => void save()}>
            保存
          </Button>
        )}
      </View>
    </View>
  );
}
