import { useMemo } from 'react'
import { Picker, Text, View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'

import { StateView } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
import {
  FormContent,
  FormField,
  FormSection,
  FormSubmitBar,
  OrganizationPicker,
  SegmentField,
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
          loginMethod: '用户名密码',
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
        isCreate: !isEdit,
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
                    // 新建时可填密码；编辑态只读展示，重置密码走列表页长按菜单
                    return field.editable ? (
                      <FormField
                        key={field.key}
                        label={field.label}
                        required={field.editable}
                        note="6–50 位，需包含字母和数字"
                        error={(errors as Record<string, string | undefined>)[field.key]}
                      >
                        <TextField
                          value={field.value}
                          onChange={(next) => setterFor(field.key)?.(next)}
                        />
                      </FormField>
                    ) : (
                      <FormField
                        key={field.key}
                        label={field.label}
                        disabled
                        note="如需修改请返回列表长按该用户"
                      >
                        <View className={styles.readonlyValue}>
                          <Text>{field.value || UNSET}</Text>
                        </View>
                      </FormField>
                    )
                  }

                  if (field.kind === 'enum') {
                    return (
                      <FormField key={field.key} label={field.label}>
                        <SegmentField
                          value={field.value}
                          options={field.options.map((label, index) => ({
                            label,
                            value: String(index),
                          }))}
                          onChange={(next) => {
                            const set = setterFor(field.key)
                            if (set) set(next)
                          }}
                        />
                      </FormField>
                    )
                  }

                  if (field.kind === 'date') {
                    const current = (values as unknown as Record<string, string>)[field.key] ?? ''
                    return (
                      <FormField
                        key={field.key}
                        label={field.label}
                        error={(errors as Record<string, string | undefined>)[field.key]}
                      >
                        <Picker
                          mode="date"
                          value={current}
                          onChange={(event) => setterFor(field.key)?.(String(event.detail.value))}
                        >
                          <View className={styles.pickerValue}>
                            <Text>{current || UNSET}</Text>
                          </View>
                        </Picker>
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
                      note={locked ? '创建后不可修改' : undefined}
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