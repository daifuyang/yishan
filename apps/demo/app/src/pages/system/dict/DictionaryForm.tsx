import { useEffect, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Button } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { useCanWrite } from "@/hooks";
import * as api from "@/api/admin/dict";
import type { AdminDictData, AdminDictType } from "@/api/admin/types";
import { AdminSelect, AdminNotice, errorMessage } from "../_shared/AdminUI";
import { dictionaryDataPayload, dictionaryTypePayload, type DictionaryFormValues } from "./form";
import { useCurrentModuleAccess } from "@/utils/auth-guard";

type Props = { onCancel: () => void; onSuccess: () => void } & (
  | { typeId: number; record?: AdminDictData }
  | { typeId?: undefined; record?: AdminDictType }
);

export default function DictionaryForm(props: Props) {
  const { record, typeId, onCancel, onSuccess } = props;
  const canSave = useCanWrite(record ? "system:dict:update" : "system:dict:create");
  const isCurrent = useCurrentModuleAccess('system-dict');
  const required = [record ? 'system:dict:update' : 'system:dict:create'];
  const canList = useCanWrite("system:dict:list");
  const [values, setValues] = useState<DictionaryFormValues>({
    name: "",
    type: "",
    label: "",
    value: "",
    status: "1",
    sort: "0",
    remark: "",
    tag: "",
    isDefault: false,
  });
  const [loading, setLoading] = useState(Boolean(record));
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
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
    if (!record || !canList) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    const request = typeId ? api.getAdminDictData(record.id) : api.getAdminDictType(record.id);
    request
      .then((data) => {
        if (!current) return;
        setValues({
          name: "name" in data ? data.name : "",
          type: data.type,
          label: "label" in data ? data.label : "",
          value: "value" in data ? data.value : "",
          status: String(data.status),
          sort: String(data.sort_order),
          remark: data.remark || "",
          tag: "tag" in data ? data.tag || "" : "",
          isDefault: "isDefault" in data ? data.isDefault : false,
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
  }, [record?.id, typeId, canList, reload]);
  const field = (name: keyof DictionaryFormValues, value: string | boolean) =>
    setValues((previous) => ({ ...previous, [name]: value }));
  const save = async () => {
    if (lock.current || !canSave || !isCurrent(required) || loading || loadError) return;
    lock.current = true;
    setSaving(true);
    setError("");
    try {
      if (typeId) {
        const payload = dictionaryDataPayload(values, typeId);
        if (record) await api.updateAdminDictData(record.id, payload);
        else await api.createAdminDictData(payload);
      } else {
        const payload = dictionaryTypePayload(values);
        if (record) await api.updateAdminDictType(record.id, payload);
        else await api.createAdminDictType(payload);
      }
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
      <Text className="admin-section-title">
        {record ? "编辑" : "新建"}
        {typeId ? "字典项" : "字典类型"}
      </Text>
      {loading && <AdminNotice>加载详情…</AdminNotice>}
      {loadError && <AdminNotice>{loadError}</AdminNotice>}
      {typeId ? (
        <>
          <FormField
            type="input"
            label="字典标签"
            required
            maxLength={100}
            value={values.label}
            disabled={loading || saving}
            onInput={(value) => field("label", value)}
          />
          <FormField
            type="input"
            label="字典键值"
            required
            maxLength={100}
            value={values.value}
            disabled={loading || saving}
            onInput={(value) => field("value", value)}
          />
        </>
      ) : (
        <>
          <FormField
            type="input"
            label="字典名称"
            required
            maxLength={100}
            value={values.name}
            disabled={loading || saving}
            onInput={(value) => field("name", value)}
          />
          <FormField
            type="input"
            label="字典类型"
            required
            maxLength={100}
            value={values.type}
            disabled={loading || saving}
            onInput={(value) => field("type", value)}
          />
        </>
      )}
      <AdminSelect
        label="状态"
        value={values.status}
        disabled={loading || saving}
        options={[
          { label: "正常", value: "1" },
          { label: "停用", value: "0" },
        ]}
        onChange={(value) => field("status", value)}
      />
      <FormField
        type="input"
        label="排序"
        inputType="number"
        value={values.sort}
        disabled={loading || saving}
        onInput={(value) => field("sort", value)}
      />
      {typeId && (
        <>
          <FormField
            type="input"
            label="标签样式"
            maxLength={50}
            value={values.tag}
            disabled={loading || saving}
            placeholder="success、error、blue"
            onInput={(value) => field("tag", value)}
          />
          <FormField
            type="switch"
            label="默认值"
            checked={values.isDefault}
            disabled={loading || saving}
            onChange={(value) => field("isDefault", value)}
          />
        </>
      )}
      <FormField
        type="textarea"
        label="备注"
        maxLength={255}
        value={values.remark}
        disabled={loading || saving}
        onInput={(value) => field("remark", value)}
      />
      {error && <AdminNotice>{error}</AdminNotice>}
      <View className="admin-actions">
        <Button
          disabled={loading || !canSave || Boolean(loadError)}
          loading={saving}
          onClick={save}
        >
          保存
        </Button>
        <Button variant="secondary" disabled={saving} onClick={onCancel}>
          取消
        </Button>
        {loadError && (
          <Button variant="secondary" onClick={() => setReload((count) => count + 1)}>
            重新加载
          </Button>
        )}
      </View>
    </View>
  );
}
