import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useRef, useState } from "react";
import {
  type AdminMenu,
  type AdminPermission,
  createAdminMenu,
  getAdminMenu,
  getAdminPermissionCatalog,
  type SaveAdminMenu,
  updateAdminMenu,
} from "@/api/admin/menu";
import { getSessionVersion } from "@/api/client";
import { Button } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { useCanWrite } from "@/hooks";
import { canWriteModuleNow } from "@/utils/auth-guard";
import { AdminNotice, AdminSelect, errorMessage } from "../_shared/AdminUI";
import { menuParentOptions } from "./parents";

export function MenuEditor({
  id,
  parentId,
  tree,
  editable,
  onClose,
  onSaved,
}: {
  id?: number;
  parentId?: number;
  tree: AdminMenu[];
  editable: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const canSave = useCanWrite(id ? "system:menu:update" : "system:menu:create");
  const canCatalog = useCanWrite("system:permission:catalog");
  const [values, setValues] = useState<SaveAdminMenu>({
    name: "",
    type: 0,
    parentId,
    path: "",
    icon: "",
    component: "",
    status: "1",
    sort_order: 0,
    hideInMenu: false,
    isDefaultAction: false,
    isExternalLink: false,
    permissionCodes: [],
    keepAlive: false,
  });
  const [sort, setSort] = useState("0");
  const [catalog, setCatalog] = useState<AdminPermission[] | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(!id);
  const [error, setError] = useState("");
  const [optionError, setOptionError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [permissionsChanged, setPermissionsChanged] = useState(false);
  const locked = useRef(false);
  const session = useRef(getSessionVersion()).current;
  const required = [id ? "system:menu:update" : "system:menu:create"];
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    setLoading(true);
    setError("");
    const detail = id
      ? getAdminMenu(id)
          .then((menu) => {
            if (
              !active ||
              session !== getSessionVersion() ||
              !canWriteModuleNow("system-menu", ["system:menu:list"])
            )
              return;
            setValues({
              name: menu.name,
              type: menu.type,
              parentId: menu.parentId,
              path: menu.path || "",
              icon: menu.icon || "",
              component: menu.component || "",
              status: menu.status,
              sort_order: menu.sort_order,
              hideInMenu: menu.hideInMenu,
              isDefaultAction: menu.isDefaultAction,
              isExternalLink: menu.isExternalLink,
              permissionCodes: menu.permissionCodes,
              keepAlive: menu.keepAlive,
            });
            setSort(String(menu.sort_order));
            setLoaded(true);
          })
          .catch((cause) => {
            if (active && session === getSessionVersion()) setError(errorMessage(cause));
          })
      : Promise.resolve();
    const options = canCatalog
      ? getAdminPermissionCatalog()
          .then((items) => {
            if (active && session === getSessionVersion()) setCatalog(items);
          })
          .catch(() => {
            if (active && session === getSessionVersion())
              setOptionError("关联功能加载失败，现有关联将保留。");
          })
      : Promise.resolve();
    void Promise.all([detail, options]).finally(() => {
      if (active && session === getSessionVersion()) setLoading(false);
    });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [id, retry, canCatalog, session]);
  const disabled = !editable || !canSave || busy || loading || !loaded;
  const options = menuParentOptions(tree, id);
  // The current API accepts numeric parents, but cannot clear an existing parent.
  if (!id || values.parentId == null) options.unshift({ value: "", label: "顶级菜单" });
  async function save() {
    if (
      disabled ||
      locked.current ||
      session !== getSessionVersion() ||
      !canWriteModuleNow("system-menu", required)
    )
      return;
    if (!values.name.trim()) {
      setError("请输入菜单名称");
      return;
    }
    if (!sort.trim() || !Number.isFinite(Number(sort)) || Number(sort) < 0) {
      setError("排序须为非负数字");
      return;
    }
    if (
      values.type !== 0 &&
      !values.isExternalLink &&
      !/^\.{1,2}\/[\w\-./]+$/.test(values.component || "")
    ) {
      setError("请填写有效组件路径，如 ./system/menu");
      return;
    }
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const { permissionCodes, ...rest } = values;
      const payload: SaveAdminMenu = {
        ...rest,
        name: values.name.trim(),
        sort_order: Number(sort),
      };
      if (!id || permissionsChanged)
        payload.permissionCodes = values.type === 0 ? [] : permissionCodes;
      if (id) await updateAdminMenu(id, payload);
      else await createAdminMenu(payload);
      if (
        mounted.current &&
        session === getSessionVersion() &&
        canWriteModuleNow("system-menu", required)
      ) {
        void Taro.showToast({ title: "保存成功", icon: "success" });
        onSaved();
      }
    } catch (cause) {
      if (
        mounted.current &&
        session === getSessionVersion() &&
        canWriteModuleNow("system-menu", required)
      )
        setError(errorMessage(cause));
    } finally {
      locked.current = false;
      if (
        mounted.current &&
        session === getSessionVersion() &&
        canWriteModuleNow("system-menu", required)
      )
        setBusy(false);
    }
  }
  return (
    <View className="admin-card">
      <Text className="admin-section-title">
        {id ? (editable ? "编辑菜单" : "菜单详情") : "新建菜单"}
      </Text>
      {loading ? (
        <AdminNotice>加载中…</AdminNotice>
      ) : (
        loaded && (
          <>
            <AdminSelect
              label="上级菜单"
              value={values.parentId == null ? "" : String(values.parentId)}
              options={options}
              disabled={disabled}
              onChange={(parent) =>
                setValues({ ...values, parentId: parent ? Number(parent) : undefined })
              }
            />
            <AdminSelect
              label="菜单类型"
              value={String(values.type)}
              disabled={disabled}
              options={[
                { label: "目录", value: "0" },
                { label: "页面", value: "1" },
                { label: "按钮", value: "2" },
              ]}
              onChange={(type) => {
                setValues({ ...values, type: type === "0" ? 0 : type === "1" ? 1 : 2 });
                if (type === "0") setPermissionsChanged(true);
              }}
            />
            <FormField
              type="input"
              label="菜单名称"
              required
              value={values.name}
              maxLength={100}
              disabled={disabled}
              onChange={(name) => setValues({ ...values, name })}
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
              type="input"
              label="图标"
              value={values.icon}
              maxLength={100}
              disabled={disabled}
              onChange={(icon) => setValues({ ...values, icon })}
            />
            <FormField
              type="input"
              label="路由路径 / 外链"
              value={values.path}
              maxLength={255}
              disabled={disabled}
              onChange={(path) => setValues({ ...values, path })}
            />
            <FormField
              type="switch"
              label="外链"
              checked={values.isExternalLink}
              disabled={disabled}
              onChange={(isExternalLink) => setValues({ ...values, isExternalLink })}
            />
            {values.type !== 0 && (
              <FormField
                type="input"
                label="组件路径"
                required={!values.isExternalLink}
                value={values.component}
                maxLength={255}
                disabled={disabled}
                onChange={(component) => setValues({ ...values, component })}
              />
            )}
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
              type="switch"
              label="在菜单中隐藏"
              checked={values.hideInMenu}
              disabled={disabled}
              onChange={(hideInMenu) => setValues({ ...values, hideInMenu })}
            />
            <FormField
              type="switch"
              label="缓存页面"
              checked={values.keepAlive}
              disabled={disabled}
              onChange={(keepAlive) => setValues({ ...values, keepAlive })}
            />
            {values.type === 2 && (
              <FormField
                type="switch"
                label="页面默认访问操作"
                checked={values.isDefaultAction}
                disabled={disabled}
                onChange={(isDefaultAction) => setValues({ ...values, isDefaultAction })}
              />
            )}
            {values.type !== 0 && (
              <>
                <Text className="admin-section-title">关联功能</Text>
                {catalog === null ? (
                  <AdminNotice>功能目录不可用，现有关联保持不变。</AdminNotice>
                ) : (
                  <>
                    <FormField type="input" label="搜索功能" value={search} onChange={setSearch} />
                    {catalog
                      .filter((item) =>
                        `${item.label} ${item.code}`.toLowerCase().includes(search.toLowerCase()),
                      )
                      .map((item) => (
                        <FormField
                          key={item.code}
                          type="switch"
                          label={item.label}
                          checked={values.permissionCodes?.includes(item.code)}
                          disabled={disabled}
                          onChange={(checked) => {
                            setValues({
                              ...values,
                              permissionCodes: checked
                                ? [...(values.permissionCodes || []), item.code]
                                : (values.permissionCodes || []).filter(
                                    (code) => code !== item.code,
                                  ),
                            });
                            setPermissionsChanged(true);
                          }}
                        />
                      ))}
                  </>
                )}
              </>
            )}
          </>
        )
      )}
      {optionError && <AdminNotice>{optionError}</AdminNotice>}
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
