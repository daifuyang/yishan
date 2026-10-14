import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import '../../_shared/admin.scss'
import { type AdminAppMenu, getAdminAppMenuTree } from '@/api/admin/appMenu'
import {
  type AdminMenu,
  type AdminPermission,
  getAdminMenuTree,
  getAdminPermissionCatalog,
} from '@/api/admin/menu'
import {
  createAdminRole,
  getAdminRole,
  type SaveAdminRole,
  updateAdminRole,
} from '@/api/admin/role'
import { getSessionVersion } from '@/api/client'
import { Button } from '@/components/atoms'
import { FormField } from '@/components/molecules'
import { EnumField, FormError } from '@/components/management'
import { useCanWrite } from '@/hooks'
import { hasRequiredPermissions } from '@/modules/registry'
import { useAuthStore } from '@/stores/auth'
import { canWriteModuleNow } from '@/utils/auth-guard'
import { errorMessage } from '@/utils/account-scope'
import { buildRoleAuthorization, flattenMenus } from './authorization'

const scopes = [
  { value: '1', label: '全部数据' },
  { value: '2', label: '本部门数据' },
  { value: '3', label: '本部门及子部门数据' },
  { value: '4', label: '仅本人数据' },
  { value: '5', label: '自定义数据' },
]

export function RoleEditor({
  id,
  editable,
  onClose,
  onSaved,
}: {
  id?: number
  editable: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const canSave = useCanWrite(id ? 'system:role:update' : 'system:role:create', 'system:role:grant')
  const canMenus = useCanWrite('system:menu:list')
  const canApps = useCanWrite('system:app-menu:list')
  const canCatalog = useCanWrite('system:permission:catalog')
  const permissions = useAuthStore((state) => state.user?.permissions)
  const [values, setValues] = useState<SaveAdminRole>({
    name: '',
    description: '',
    status: '1',
    dataScope: '1',
    menuIds: [],
    appMenuIds: [],
    permissionCodes: [],
  })
  const [menus, setMenus] = useState<AdminMenu[] | null>(null)
  const [apps, setApps] = useState<AdminAppMenu[] | null>(null)
  const [catalog, setCatalog] = useState<AdminPermission[] | null>(null)
  const [changed, setChanged] = useState({ menus: false, apps: false, permissions: false })
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(!id)
  const [error, setError] = useState('')
  const [optionError, setOptionError] = useState('')
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const locked = useRef(false)
  const session = useRef(getSessionVersion()).current
  const required = [id ? 'system:role:update' : 'system:role:create', 'system:role:grant']
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    let active = true
    setLoading(true)
    setError('')
    setOptionError('')
    const detail = id
      ? getAdminRole(id)
          .then((role) => {
            if (
              !active ||
              session !== getSessionVersion() ||
              !canWriteModuleNow('system-role', ['system:role:list'])
            )
              return
            setValues({
              name: role.name,
              description: role.description || '',
              status: role.status,
              dataScope: role.dataScope,
              menuIds: role.menuIds || [],
              appMenuIds: role.appMenuIds || [],
              permissionCodes: role.permissionCodes || [],
            })
            setLoaded(true)
          })
          .catch((cause) => {
            if (active && session === getSessionVersion()) setError(errorMessage(cause))
          })
      : Promise.resolve()
    const options = async () => {
      const results = await Promise.allSettled([
        canMenus ? getAdminMenuTree() : Promise.resolve(null),
        canApps ? getAdminAppMenuTree() : Promise.resolve(null),
        canCatalog ? getAdminPermissionCatalog() : Promise.resolve(null),
      ])
      if (
        !active ||
        session !== getSessionVersion() ||
        !canWriteModuleNow('system-role', ['system:role:list'])
      )
        return
      const [menuResult, appResult, catalogResult] = results
      if (menuResult.status === 'fulfilled') setMenus(menuResult.value)
      if (appResult.status === 'fulfilled') setApps(appResult.value)
      if (catalogResult.status === 'fulfilled') setCatalog(catalogResult.value)
      const failures = results.filter((result) => result.status === 'rejected')
      if (failures.length)
        setOptionError('部分授权选项加载失败，未修改的授权将保留。请关闭后重试。')
    }
    void Promise.all([detail, options()]).finally(() => {
      if (active && session === getSessionVersion()) setLoading(false)
    })
    return () => {
      active = false
      mounted.current = false
    }
  }, [id, retry, canMenus, canApps, canCatalog, session])
  const disabled = !editable || !canSave || busy || loading || !loaded
  const selectedMenus = values.menuIds || []
  const selectedApps = values.appMenuIds || []
  const selectedCodes = values.permissionCodes || []
  const menuNodes = menus ? flattenMenus(menus).filter((node) => node.type !== 2) : []
  async function save() {
    if (
      disabled ||
      locked.current ||
      session !== getSessionVersion() ||
      !canWriteModuleNow('system-role', required)
    )
      return
    if (!values.name.trim()) {
      setError('请输入角色名称')
      return
    }
    locked.current = true
    setBusy(true)
    setError('')
    try {
      const payload: SaveAdminRole = {
        name: values.name.trim(),
        description: values.description,
        status: values.status,
        dataScope: values.dataScope,
      }
      const grants = buildRoleAuthorization(
        { menuIds: selectedMenus, appMenuIds: selectedApps, permissionCodes: selectedCodes },
        menus || [],
        apps || [],
      )
      // Unchanged grants are omitted so editing basic fields cannot clear inaccessible grants.
      if (changed.menus) payload.menuIds = grants.menuIds
      if (changed.apps) payload.appMenuIds = grants.appMenuIds
      if (changed.permissions) payload.permissionCodes = grants.permissionCodes
      if (id) await updateAdminRole(id, payload)
      else await createAdminRole(payload)
      if (
        mounted.current &&
        session === getSessionVersion() &&
        canWriteModuleNow('system-role', required)
      ) {
        void Taro.showToast({ title: '保存成功', icon: 'success' })
        onSaved()
      }
    } catch (cause) {
      if (
        mounted.current &&
        session === getSessionVersion() &&
        canWriteModuleNow('system-role', required)
      )
        setError(errorMessage(cause))
    } finally {
      locked.current = false
      if (
        mounted.current &&
        session === getSessionVersion() &&
        canWriteModuleNow('system-role', required)
      )
        setBusy(false)
    }
  }
  return (
    <View className="admin-card">
      <Text className="admin-section-title">
        {id ? (editable ? '编辑角色' : '角色详情') : '新建角色'}
      </Text>
      {loading ? (
        <FormError>加载中…</FormError>
      ) : (
        loaded && (
          <>
            <FormField
              type="input"
              label="角色名称"
              required
              value={values.name}
              maxLength={50}
              disabled={disabled}
              onChange={(name) => setValues({ ...values, name })}
            />
            <FormField
              type="textarea"
              label="角色描述"
              value={values.description}
              maxLength={255}
              disabled={disabled}
              onInput={(description) => setValues({ ...values, description })}
            />
            <EnumField
              label="状态"
              value={values.status || '1'}
              disabled={disabled}
              options={[
                { value: '1', label: '启用' },
                { value: '0', label: '禁用' },
              ]}
              onChange={(status) => setValues({ ...values, status: status === '1' ? '1' : '0' })}
            />
            <EnumField
              label="数据范围"
              value={values.dataScope || '1'}
              disabled={disabled}
              options={scopes}
              onChange={(scope) =>
                setValues({ ...values, dataScope: scope as SaveAdminRole['dataScope'] })
              }
            />
            <Text className="admin-section-title">菜单访问</Text>
            {menus === null ? (
              <FormError>菜单选项不可用，现有菜单授权保持不变。</FormError>
            ) : (
              menuNodes.map((node) => (
                <FormField
                  key={node.id}
                  type="switch"
                  label={`${node.name}${node.status === '0' ? '（禁用）' : ''}`}
                  checked={selectedMenus.includes(node.id)}
                  disabled={disabled}
                  onChange={(checked) => {
                    setValues({
                      ...values,
                      menuIds: checked
                        ? [...selectedMenus, node.id]
                        : selectedMenus.filter((item) => item !== node.id),
                    })
                    setChanged({ ...changed, menus: true })
                  }}
                />
              ))
            )}
            <Text className="admin-section-title">功能权限</Text>
            {catalog === null ? (
              <FormError>功能选项不可用，现有功能授权保持不变。</FormError>
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
                      hint={item.description}
                      checked={selectedCodes.includes(item.code)}
                      disabled={
                        disabled ||
                        (!selectedCodes.includes(item.code) &&
                          !hasRequiredPermissions([item.code], permissions))
                      }
                      onChange={(checked) => {
                        setValues({
                          ...values,
                          permissionCodes: checked
                            ? [...selectedCodes, item.code]
                            : selectedCodes.filter((code) => code !== code),
                        })
                        setChanged({ ...changed, permissions: true })
                      }}
                    />
                  ))}
                {selectedCodes
                  .filter((code) => !catalog.some((item) => item.code === code))
                  .map((code) => (
                    <FormField
                      key={code}
                      type="switch"
                      label={code}
                      checked
                      disabled={disabled}
                      onChange={() => {
                        setValues({
                          ...values,
                          permissionCodes: selectedCodes.filter((item) => item !== code),
                        })
                        setChanged({ ...changed, permissions: true })
                      }}
                    />
                  ))}
              </>
            )}
            <Text className="admin-section-title">工作台入口</Text>
            {apps === null ? (
              <FormError>入口选项不可用，现有工作台授权保持不变。</FormError>
            ) : (
              apps.map((group) => (
                <View key={group.id}>
                  <Text className="admin-section-title">{group.name}</Text>
                  {(group.children || []).map((entry) => (
                    <FormField
                      key={entry.id}
                      type="switch"
                      label={`${entry.name}${entry.status === '0' ? '（禁用）' : ''}`}
                      checked={selectedApps.includes(entry.id)}
                      disabled={disabled}
                      onChange={(checked) => {
                        setValues({
                          ...values,
                          appMenuIds: checked
                            ? [...selectedApps, entry.id]
                            : selectedApps.filter((item) => item !== entry.id),
                        })
                        setChanged({ ...changed, apps: true })
                      }}
                    />
                  ))}
                </View>
              ))
            )}
          </>
        )
      )}
      {optionError && <FormError>{optionError}</FormError>}
      {error && (
        <>
          <FormError>{error}</FormError>
          {!loaded && (
            <Button variant="text" onClick={() => setRetry(retry + 1)}>
              重新加载
            </Button>
          )}
        </>
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
  )
}
