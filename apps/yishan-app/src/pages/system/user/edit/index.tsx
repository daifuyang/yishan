import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState } from 'react'
import { AppText, Button, Tag } from '@/components/atoms'
import { PageHeader, Card, FormField, BottomActionBar } from '@/components/molecules'
import { StateView } from '@/components/feedback'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateBack } from '@/utils/router'
import { useUserEditForm } from './hooks/useUserEditForm'
import styles from './index.module.scss'

export default function UserEditPage() {
  useRequireAuth()
  const router = useRouter()
  const id = router.params.id
  const {
    values, errors, loading, pageError, submitting,
    depts, roles, isEdit, genderLabel, statusLabel,
    handleSubmit, toggleDept, toggleRole,
  } = useUserEditForm(id)

  const kind: 'loading' | 'error' | 'ready' = pageError ? 'error' : loading ? 'loading' : 'ready'

  return (
    <View>
      <PageHeader title={isEdit ? '编辑用户' : '创建用户'} showBack />

      <StateView kind={kind} error={pageError} onRetry={() => Taro.navigateBack()}>
        <Card title="基本信息">
          <FormField label="用户名" required={!isEdit} error={errors.username}>
            <AppText
              input
              placeholder="请输入用户名"
              value={values.username}
              onChange={values.setUsername}
              disabled={isEdit}
              maxlength={50}
            />
            {isEdit && (
              <Text className={styles.edit__hint}>用户名不可修改</Text>
            )}
          </FormField>
          <FormField label="真实姓名" error={errors.realName}>
            <AppText
              input
              placeholder="请输入真实姓名"
              value={values.realName}
              onChange={values.setRealName}
              maxlength={50}
            />
          </FormField>
          <FormField label="昵称" error={errors.nickname}>
            <AppText
              input
              placeholder="请输入昵称"
              value={values.nickname}
              onChange={values.setNickname}
              maxlength={50}
            />
          </FormField>
        </Card>

        <Card title="联系方式与凭证">
          <FormField label="手机号" required error={errors.phone}>
            <AppText
              input
              placeholder="请输入手机号"
              value={values.phone}
              onChange={values.setPhone}
              inputType="phone"
              maxlength={11}
            />
          </FormField>
          <FormField label="邮箱" error={errors.email}>
            <AppText
              input
              placeholder="请输入邮箱"
              value={values.email}
              onChange={values.setEmail}
            />
          </FormField>
          <FormField label="密码" required={!isEdit} error={errors.password}>
            <AppText
              input
              type="password"
              placeholder={isEdit ? '留空则不修改' : '请输入密码'}
              value={values.password}
              onChange={values.setPassword}
            />
          </FormField>
        </Card>

        <Card title="其他属性">
          <FormField label="性别">
            <AppText
              picker
              range={['保密', '男', '女']}
              value={genderLabel}
              onClick={() => {
                Taro.showActionSheet({
                  itemList: ['保密', '男', '女'],
                  success: (res) => values.setGender(res.tapIndex),
                })
              }}
            />
          </FormField>
          <FormField label="状态">
            <AppText
              picker
              range={['启用', '禁用', '锁定']}
              value={statusLabel}
              onClick={() => {
                Taro.showActionSheet({
                  itemList: ['启用', '禁用', '锁定'],
                  success: (res) => values.setStatus(res.tapIndex),
                })
              }}
            />
          </FormField>
        </Card>

        <Card title="所属部门">
          <View className={styles.edit__chips}>
            {depts.map((dept: any) => (
              <Tag
                key={dept.id}
                variant="primary"
                outline={!values.deptIds.includes(dept.id)}
                onClick={() => toggleDept(dept.id)}
              >
                {dept.name}
              </Tag>
            ))}
          </View>
          {values.deptIds.length > 0 && (
            <View className={styles.edit__tags}>
              {values.deptIds.map((id) => {
                const dept = depts.find((d: any) => d.id === id)
                return dept ? (
                  <Tag key={id} variant="primary" size="small">{dept.name}</Tag>
                ) : null
              })}
            </View>
          )}
        </Card>

        <Card title="角色">
          <View className={styles.edit__chips}>
            {roles.map((role: any) => (
              <Tag
                key={role.id}
                variant="success"
                outline={!values.roleIds.includes(role.id)}
                onClick={() => toggleRole(role.id)}
              >
                {role.name}
              </Tag>
            ))}
          </View>
          {values.roleIds.length > 0 && (
            <View className={styles.edit__tags}>
              {values.roleIds.map((id) => {
                const role = roles.find((r: any) => r.id === id)
                return role ? (
                  <Tag key={id} variant="success" size="small">{role.name}</Tag>
                ) : null
              })}
            </View>
          )}
        </Card>
      </StateView>

      <BottomActionBar>
        <Button
          type="primary"
          size="large"
          fullWidth
          loading={submitting}
          onClick={handleSubmit}
        >
          保存
        </Button>
      </BottomActionBar>
    </View>
  )
}
