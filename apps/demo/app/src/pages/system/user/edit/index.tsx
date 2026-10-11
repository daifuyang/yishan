import { Picker, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'

import { Button, Tag } from '@/components/atoms'
import { StateView } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
import { BottomActionBar, FormField, SectionHeader } from '@/components/molecules'
import { useRequireAuth } from '@/utils/auth-guard'
import { useUserEditForm } from './hooks/useUserEditForm'
import { useAuthStore } from '@/stores/auth'
import styles from './index.module.scss'

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
    genderLabel,
    statusLabel,
    handleSubmit,
    toggleDept,
    toggleRole,
  } = form
  const kind = pageError ? 'error' : loading ? 'loading' : 'ready'

  return (
    <PageContainer>
      <StateView kind={kind} text={pageError} onRetry={form.reload}>
        <View className="gutter">
          <SectionHeader title="基本信息" />
          <FormField
            type="input"
            label="用户名"
            error={errors.username}
            placeholder="请输入用户名"
            value={values.username}
            onChange={values.setUsername}
            disabled={isEdit}
            maxLength={50}
          />
          <FormField
            type="input"
            label="真实姓名"
            error={errors.realName}
            placeholder="请输入真实姓名"
            value={values.realName}
            onChange={values.setRealName}
            maxLength={50}
          />
          <FormField
            type="input"
            label="昵称"
            error={errors.nickname}
            placeholder="请输入昵称"
            value={values.nickname}
            onChange={values.setNickname}
            maxLength={50}
          />
          <SectionHeader title="联系方式与凭证" />
          <FormField
            type="input"
            label="手机号"
            required
            error={errors.phone}
            placeholder="请输入手机号"
            value={values.phone}
            onChange={values.setPhone}
            maxLength={20}
          />
          <FormField
            type="input"
            label="邮箱"
            error={errors.email}
            placeholder="请输入邮箱"
            value={values.email}
            onChange={values.setEmail}
          />
          <FormField
            type="input"
            password
            label="密码"
            required={!isEdit}
            error={errors.password}
            placeholder={isEdit ? '留空则不修改' : '请输入密码'}
            value={values.password}
            onChange={values.setPassword}
          />
          <SectionHeader title="其他属性" />
          <Picker mode="date" value={values.birthDate} onChange={(event) => values.setBirthDate(event.detail.value)}>
            <FormField type="picker" label="出生日期" value={values.birthDate} error={errors.birthDate} placeholder="未设置" />
          </Picker>
          {values.birthDate ? <Button variant="text" onClick={() => values.setBirthDate('')}>清除出生日期</Button> : null}
          <FormField
            type="picker"
            label="性别"
            value={genderLabel}
            onClick={() => {
              void Taro.showActionSheet({ itemList: ['未知', '男', '女'] })
                .then((result) => values.setGender(String(result.tapIndex) as '0' | '1' | '2'))
                .catch(() => {})
            }}
          />
          <FormField
            type="picker"
            label="状态"
            value={statusLabel}
            onClick={() => {
              void Taro.showActionSheet({ itemList: ['禁用', '启用', '锁定'] })
                .then((result) => values.setStatus(String(result.tapIndex) as '0' | '1' | '2'))
                .catch(() => {})
            }}
          />
          <SectionHeader title="所属部门" />
          <View className={styles.edit__chips}>
            {depts.map((dept) => (
              <View key={dept.id} onClick={() => !submitting && toggleDept(dept.id)}>
                <Tag variant={values.deptIds.includes(dept.id) ? 'primary' : 'default'}>
                  {dept.name}
                </Tag>
              </View>
            ))}
          </View>
          <SectionHeader title="角色" />
          <View className={styles.edit__chips}>
            {roles.map((role) => (
              <View key={role.id} onClick={() => !submitting && toggleRole(role.id)}>
                <Tag variant={values.roleIds.includes(role.id) ? 'success' : 'default'}>
                  {role.name}
                </Tag>
              </View>
            ))}
          </View>
        </View>
        <BottomActionBar>
          <Button variant="primary" size="lg" block disabled={submitting || loading || Boolean(pageError)} loading={submitting} onClick={handleSubmit}>
            保存
          </Button>
        </BottomActionBar>
      </StateView>
    </PageContainer>
  )
}
