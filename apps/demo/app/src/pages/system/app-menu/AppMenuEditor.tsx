import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useRef, useState } from "react";
import {
  type AdminAppMenu,
  createAdminAppMenu,
  getAdminAppMenu,
  type SaveAdminAppMenu,
  updateAdminAppMenu,
} from "@/api/admin/appMenu";
import { getSessionVersion } from "@/api/client";
import { Button } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { useCanWrite } from "@/hooks";
import { canWriteModuleNow } from "@/utils/auth-guard";
import { AdminNotice, AdminSelect, errorMessage } from "../_shared/AdminUI";

export function AppMenuEditor({
  id,
  parentId,
  groups,
  editable,
  onClose,
  onSaved,
}: {
  id?: number;
  parentId?: number;
  groups: AdminAppMenu[];
  editable: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const canSave = useCanWrite(id ? "system:app-menu:update" : "system:app-menu:create");
  const [values, setValues] = useState<SaveAdminAppMenu>({
    name: "",
    type: parentId ? 1 : 0,
    parentId,
    icon: "",
    page: "",
    moduleId: "core",
    status: "1",
  });
  const [sort, setSort] = useState("");
  const [hasChildren, setHasChildren] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [loaded, setLoaded] = useState(!id);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const session = useRef(getSessionVersion()).current;
  const required = [id ? "system:app-menu:update" : "system:app-menu:create"];
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    if (id) {
      setLoading(true);
      setError("");
      getAdminAppMenu(id)
        .then((menu) => {
          if (
            !active ||
            session !== getSessionVersion() ||
            !canWriteModuleNow("system-app-menu", ["system:app-menu:list"])
          )
            return;
          setValues({
            name: menu.name,
            type: menu.type,
            parentId: menu.parentId,
            icon: menu.icon || "",
            page: menu.page || "",
            moduleId: menu.moduleId,
            status: menu.status,
            sortOrder: menu.sortOrder,
          });
          setSort(String(menu.sortOrder));
          setHasChildren(
            Boolean(
              menu.children?.length || groups.find((group) => group.id === id)?.children?.length,
            ),
          );
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
  }, [id, retry, groups, session]);
  const disabled = !editable || !canSave || busy || loading || !loaded;
  async function save() {
    if (
      disabled ||
      locked.current ||
      session !== getSessionVersion() ||
      !canWriteModuleNow("system-app-menu", required)
    )
      return;
    if (!values.name.trim()) {
      setError("请输入名称");
      return;
    }
    if (
      values.type === 1 &&
      (!values.parentId ||
        !groups.some((group) => group.id === values.parentId && group.type === 0))
    ) {
      setError("请选择所属分组");
      return;
    }
    if (values.type === 1 && !/^pages\/[\w\-/]+$/.test(values.page || "")) {
      setError("请填写有效页面路径，如 pages/system/user/index");
      return;
    }
    if (sort.trim() && (!Number.isInteger(Number(sort)) || Number(sort) < 0)) {
      setError("排序须为非负整数");
      return;
    }
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const payload: SaveAdminAppMenu = {
        ...values,
        name: values.name.trim(),
        parentId: values.type === 0 ? undefined : values.parentId,
        page: values.type === 0 ? undefined : values.page,
        moduleId: values.moduleId?.trim() || "core",
        sortOrder: sort.trim() ? Number(sort) : undefined,
      };
      if (id) await updateAdminAppMenu(id, payload);
      else await createAdminAppMenu(payload);
      if (
        mounted.current &&
        session === getSessionVersion() &&
        canWriteModuleNow("system-app-menu", required)
      ) {
        void Taro.showToast({ title: "保存成功", icon: "success" });
        onSaved();
      }
    } catch (cause) {
      if (
        mounted.current &&
        session === getSessionVersion() &&
        canWriteModuleNow("system-app-menu", required)
      )
        setError(errorMessage(cause));
    } finally {
      locked.current = false;
      if (
        mounted.current &&
        session === getSessionVersion() &&
        canWriteModuleNow("system-app-menu", required)
      )
        setBusy(false);
    }
  }
  return (
    <View className="admin-card">
      <Text className="admin-section-title">
        {id ? (editable ? "编辑工作台菜单" : "工作台菜单详情") : "新建工作台菜单"}
      </Text>
      {loading ? (
        <AdminNotice>加载中…</AdminNotice>
      ) : (
        loaded && (
          <>
            <AdminSelect
              label="类型"
              value={String(values.type)}
              disabled={disabled || hasChildren}
              options={[
                { label: "分组", value: "0" },
                { label: "应用入口", value: "1" },
              ]}
              onChange={(type) => setValues({ ...values, type: type === "0" ? 0 : 1 })}
            />
            {values.type === 1 && (
              <AdminSelect
                label="所属分组"
                value={values.parentId == null ? "" : String(values.parentId)}
                disabled={disabled}
                options={[
                  { label: "请选择", value: "" },
                  ...groups
                    .filter((group) => group.type === 0 && group.id !== id)
                    .map((group) => ({ label: group.name, value: String(group.id) })),
                ]}
                onChange={(parent) =>
                  setValues({ ...values, parentId: parent ? Number(parent) : undefined })
                }
              />
            )}
            <FormField
              type="input"
              label="名称"
              required
              value={values.name}
              maxLength={100}
              disabled={disabled}
              onChange={(name) => setValues({ ...values, name })}
            />
            <FormField
              type="input"
              label="图标名"
              value={values.icon}
              maxLength={100}
              disabled={disabled}
              onChange={(icon) => setValues({ ...values, icon })}
            />
            {values.type === 1 && (
              <>
                <FormField
                  type="input"
                  label="页面路径"
                  required
                  value={values.page}
                  maxLength={255}
                  disabled={disabled}
                  onChange={(page) => setValues({ ...values, page })}
                />
                <FormField
                  type="input"
                  label="所属模块"
                  value={values.moduleId}
                  maxLength={64}
                  disabled={disabled}
                  onChange={(moduleId) => setValues({ ...values, moduleId })}
                />
              </>
            )}
            <FormField
              type="input"
              label="排序"
              value={sort}
              placeholder="留空排在末尾"
              inputType="number"
              disabled={disabled}
              onChange={setSort}
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
          </>
        )
      )}
      {error && (
        <AdminNotice>
          {error}
          {!loaded && (
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
