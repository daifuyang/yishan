import { useMemo } from 'react'
import { Text, View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'

import { StateView } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
import {
  DateField,
  EnumField,
  FormContent,
  FormField,
  FormSection,
  FormSubmitBar,
  OrganizationPicker,
  TextField,
} from '@/components/management'
import { SYSTEM_PAGES } from '@/constants/routes'
import { navigateTo } from '@/utils/router'
import { useRequireAuth } from '@/utils/auth-guard'
import { useUserEditForm } from './hooks/useUserEditForm'
import { useAuthStore } from '@/stores/auth'
import { buildProfileSections, UNSET } from '../profileSections'
import styles from './index.module.scss'

/** 必填字段：与 edit/model.ts 的 validateUserForm 保持一致。 */
const REQUIRED_KEYS = new Set(['phone'])

export default function UserEditPage() {
  const guard = useRequireAuth({ moduleId: 'system-user' })
  const { params } = useRouter()
  const identity = useAuthStore((state) => state.user?.id)
  if (!guard.ready || !guard.allowed) return <PageContainer>{null}</PageContainer>
  return <UserEditContent key={`${identity}:${params.id ?? 'create'}`} id={params.id} />
}

function UserEditContent({ id }: { id?: string }) {
  const form = useUserEditForm(id)
  const {
    values,
    errors,
    loading,
    pageError,
    submitting,
    depts,
    roles,
    isEdit,
    canReadDepts,
    canReadRoles,
    handleSubmit,
  } = form
  const kind = pageError ? 'error' : loading ? 'loading' : 'ready'

  const sections = useMemo(
    () =>
      buildProfileSections({
        user: {
          username: values.username,
          realName: values.realName,
          nickname: values.nickname,
          phone: values.phone,
          email: values.email,
          password: values.password,
          gender: values.gender,
          birthDate: values.birthDate,
          status: values.status,
          deptIds: values.deptIds,
          roleIds: values.roleIds,
        },
        deptNames: new Map(depts.map((dept) => [dept.id, dept.name])),
        roleNames: new Map(roles.map((role) => [role.id, role.name])),
        canReadDepts,
        canReadRoles,
      }),
    [values, depts, roles, canReadDepts, canReadRoles, isEdit],
  )

  const setterFor = (key: string): ((value: string) => void) | undefined => {
    const name = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`
    return (values as unknown as Record<string, unknown>)[name] as
      | ((value: string) => void)
      | undefined
  }

  return (
    <PageContainer>
      <StateView kind={kind} text={pageError} onRetry={form.reload}>
        <FormContent>
          {sections.map((section) => (
            <View key={section.key} className={styles.group}>
              <FormSection title={section.title}>
                {section.fields.map((field) => {
                  if (field.kind === 'org') {
                    const page =
                      field.target === 'roles'
                        ? SYSTEM_PAGES.userRoles
                        : SYSTEM_PAGES.userDepartments
                    return (
                      <OrganizationPicker
                        key={field.key}
                        label={field.label}
                        ids={field.ids}
                        names={field.names}
                        onPress={() =>
                          // 必须带上当前已选：选择页的初始选中取自草稿或 ?ids=，
                          // 两者都为空时用户点「确定」会把关联清空
                          navigateTo(`/${page}?ids=${field.ids.join(',')}`)
                        }
                      />
                    )
                  }

                  if (field.kind === 'secret') {
                    // 新建必填；编辑态留空即不修改（后端按空值跳过密码字段）
                    return (
                      <FormField
                        key={field.key}
                        label={field.label}
                        required={!isEdit}
                        error={(errors as Record<string, string | undefined>)[field.key]}
                      >
                        <TextField
                          value={field.value}
                          placeholder={isEdit ? '留空则不修改' : '请输入初始密码'}
                          onChange={(next) => setterFor(field.key)?.(next)}
                        />
                      </FormField>
                    )
                  }

                  if (field.kind === 'enum') {
                    // 状态/性别默认只显示文案 + 右箭头，点击唤起原生选择器
                    return (
                      <EnumField
                        key={field.key}
                        label={field.label}
                        value={String(Number(field.value) || 0)}
                        options={field.options.map((label, index) => ({ value: String(index), label }))}
                        placeholder={UNSET}
                        error={(errors as Record<string, string | undefined>)[field.key]}
                        onChange={(next) => setterFor(field.key)?.(next)}
                      />
                    )
                  }

                  if (field.kind === 'date') {
                    const current = (values as unknown as Record<string, string>)[field.key] ?? ''
                    return (
                      <FormField
                        key={field.key}
                        label={field.label}
                        arrow
                        error={(errors as Record<string, string | undefined>)[field.key]}
                      >
                        <DateField
                          className={styles.picker}
                          value={current}
                          onChange={(next) => setterFor(field.key)?.(next)}
                        >
                          <View className={styles.pickerValue}>
                            <Text>{current || UNSET}</Text>
                          </View>
                        </DateField>
                      </FormField>
                    )
                  }

                  const current = (values as unknown as Record<string, string>)[field.key] ?? ''
                  // 用户名是登录标识，创建后不可改；其余字段按契约的 editable 决定
                  const locked = field.key === 'username' && isEdit
                  return (
                    <FormField
                      key={field.key}
                      label={field.label}
                      required={REQUIRED_KEYS.has(field.key)}
                      disabled={locked}
                      error={(errors as Record<string, string | undefined>)[field.key]}
                    >
                      <TextField
                        value={current === UNSET ? '' : current}
                        placeholder={`请输入${field.label}`}
                        disabled={locked}
                        onChange={(next) => setterFor(field.key)?.(next)}
                      />
                    </FormField>
                  )
                })}
              </FormSection>
            </View>
          ))}
        </FormContent>
        <FormSubmitBar text="保存" submitting={submitting} onSubmit={handleSubmit} />
      </StateView>
    </PageContainer>
  )
}
