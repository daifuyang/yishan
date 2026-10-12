import { PageContainer } from '@/components/layout'
import { Picker, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { createTodo, getTodo, updateTodo } from '@/api/demo'
import { getSessionVersion } from '@/api/client'
import { StateView } from '@/components/feedback'
import {
  EnumField,
  FormContent,
  FormError,
  FormField,
  FormSection,
  FormSubmitBar,
  ManagementPage,
  SwitchField,
  TextAreaField,
  TextField,
} from '@/components/management'
import { PageHeader } from '@/components/molecules'
import { useCanWrite } from '@/hooks'
import { canWriteModuleNow, useRequireAuth } from '@/utils/auth-guard'
import { navigateBack } from '@/utils/router'
import { errorMessage, withAccountScope } from '../../../system/_shared/AdminUI'
import { TODO_STATUS_LABELS, todayDate, todoFormValues, todoPayload, type TodoFormValues } from '../model'
import styles from './index.module.scss'

const STATUS_OPTIONS = TODO_STATUS_LABELS.map((label, code) => ({ value: String(code), label }))

function TodoFormPage() {
  const guard = useRequireAuth({ moduleId: 'demo-todos' })
  const rawId = useRouter().params.id
  const id = rawId ? Number(rawId) : undefined
  const required = rawId ? 'demo:todos:update' : 'demo:todos:create'
  const canSave = useCanWrite(required)
  const [values, setValues] = useState<TodoFormValues>(() => todoFormValues())
  const [loading, setLoading] = useState(Boolean(rawId))
  const [loaded, setLoaded] = useState(!rawId)
  const [error, setError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const mounted = useRef(true)
  const session = useRef(getSessionVersion()).current
  const active = () => mounted.current && session === getSessionVersion()
  const set = (patch: Partial<TodoFormValues>) =>
    setValues((previous) => ({ ...previous, ...patch }))
  useEffect(() => {
    if (process.env.TARO_ENV !== 'h5')
      void Taro.setNavigationBarTitle({ title: rawId ? '编辑 Todo' : '新建 Todo' })
  }, [rawId])
  useEffect(() => {
    mounted.current = true
    let current = true
    if (rawId && guard.ready && guard.allowed) {
      setLoading(true)
      setLoaded(false)
      setError('')
      void (async () => {
        try {
          if (!id || !Number.isInteger(id) || id <= 0) throw new Error('Todo ID 缺失或无效')
          const todo = await getTodo(id)
          if (!current || !active()) return
          setValues(todoFormValues(todo))
          setLoaded(true)
        } catch (cause) {
          if (current && active()) setError(errorMessage(cause))
        } finally {
          if (current && active()) setLoading(false)
        }
      })()
    }
    return () => {
      current = false
      mounted.current = false
    }
  }, [id, rawId, retry, guard.ready, guard.allowed, session])
  const disabled = !canSave || busy || loading || !loaded
  // 打开开关时没有日期就默认今天，免得用户面对一个空的必选项
  const toggleDue = (hasDue: boolean) =>
    set(hasDue ? { hasDue, date: values.date || todayDate() } : { hasDue })
  async function save() {
    if (disabled || locked.current || !active() || !canWriteModuleNow('demo-todos', [required]))
      return
    let payload: ReturnType<typeof todoPayload>
    try {
      payload = todoPayload(values, Boolean(id))
    } catch (cause) {
      setSubmitError(errorMessage(cause))
      return
    }
    locked.current = true
    setBusy(true)
    setSubmitError('')
    try {
      if (id) await updateTodo(id, payload)
      else await createTodo({ ...payload, dueAt: payload.dueAt ?? undefined })
      if (active() && canWriteModuleNow('demo-todos', [required])) {
        void Taro.showToast({ title: '保存成功', icon: 'success' })
        navigateBack(1)
      }
    } catch (cause) {
      if (active()) setSubmitError(errorMessage(cause))
    } finally {
      locked.current = false
      if (active()) setBusy(false)
    }
  }
  if (!guard.ready || !guard.allowed) return <PageContainer>{null}</PageContainer>
  return (
    <ManagementPage>
      {process.env.TARO_ENV === 'h5' ? (
        <PageHeader title={rawId ? '编辑 Todo' : '新建 Todo'} />
      ) : null}
      <StateView
        kind={error ? 'error' : loading ? 'loading' : 'ready'}
        text={error || undefined}
        onRetry={() => setRetry((value) => value + 1)}
      >
        <FormContent>
          <FormSection title="基础信息">
            <FormField label="标题" required disabled={disabled}>
              <TextField
                value={values.title}
                onChange={(title) => set({ title })}
                placeholder="请输入标题"
                maxlength={200}
                disabled={disabled}
              />
            </FormField>
            <EnumField
              label="状态"
              value={values.status}
              options={STATUS_OPTIONS}
              onChange={(status) => set({ status })}
              disabled={disabled}
            />
            <FormField label="描述" stacked disabled={disabled}>
              <TextAreaField
                value={values.description}
                onChange={(description) => set({ description })}
                placeholder="请输入描述"
                maxlength={2000}
                disabled={disabled}
              />
            </FormField>
          </FormSection>
          <FormSection title="截止时间">
            <SwitchField
              label="启用"
              checked={values.hasDue}
              onChange={toggleDue}
              disabled={disabled}
            />
            {values.hasDue ? (
              <>
                <FormField label="日期" arrow disabled={disabled}>
                  <Picker
                    className={styles.picker}
                    mode="date"
                    value={values.date}
                    disabled={disabled}
                    onChange={(event) => set({ date: String(event.detail.value) })}
                  >
                    <View className={styles.pickerValue}>
                      <Text className={values.date ? undefined : styles.pickerPlaceholder}>
                        {values.date || '请选择'}
                      </Text>
                    </View>
                  </Picker>
                </FormField>
                <FormField label="时间" arrow disabled={disabled}>
                  <Picker
                    className={styles.picker}
                    mode="time"
                    value={values.time}
                    disabled={disabled}
                    onChange={(event) => set({ time: String(event.detail.value) })}
                  >
                    <View className={styles.pickerValue}>
                      <Text>{values.time}</Text>
                    </View>
                  </Picker>
                </FormField>
              </>
            ) : null}
          </FormSection>
          <FormError>{submitError}</FormError>
        </FormContent>
        {canSave && loaded ? (
          <FormSubmitBar text="保存" submitting={busy} onSubmit={() => void save()} />
        ) : null}
      </StateView>
    </ManagementPage>
  )
}
export default withAccountScope(TodoFormPage)
