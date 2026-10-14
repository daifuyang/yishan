import Taro from '@tarojs/taro'
import { useEffect, useRef, type ReactNode } from 'react'
import { PickerValue } from './PickerRow'
import type { TimeFieldProps } from './TimeField'
import { lockTimePickerScroll } from './timePickerScroll.h5'
import { selectorPickerItems } from './selectorPickerItems'
import styles from './ManagementAtoms.module.scss'

const hours = Array.from({ length: 24 }, (_, value) => ({ label: `${String(value).padStart(2, '0')} 时`, value }))
const minutes = Array.from({ length: 60 }, (_, value) => ({ label: `${String(value).padStart(2, '0')} 分`, value }))

interface Props extends TimeFieldProps {
  mode: 'date' | 'time' | 'selector'
  range?: readonly string[]
  title?: string
  start?: string
  end?: string
  placeholder?: string
  className?: string
  children?: ReactNode
}

export function WeuiDateTimeField({ value, disabled, onChange, mode, range = [], title: customTitle, start = '1875-01-01', end = '2100-01-01', placeholder, className, children }: Props) {
  const title = customTitle || (mode === 'date' ? '选择日期' : mode === 'time' ? '选择时间' : '请选择')
  const displayValue = mode === 'selector' ? range[Number(value)] || '' : value
  const trigger = useRef<HTMLButtonElement | null>(null)
  const mounted = useRef(true)
  const pending = useRef(false)
  const close = useRef<(() => void) | undefined>()
  const latest = useRef({ value, disabled, onChange, start, end, range })
  latest.current = { value, disabled, onChange, start, end, range }
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      close.current?.()
    }
  }, [])

  async function open() {
    if (disabled || pending.current || close.current) return
    if (mode === 'selector' && !range.length) return
    pending.current = true
    try {
      const [{ default: weui }] = await Promise.all([
        import('weui.js'),
        import('./WeuiPicker.h5.css').then(() => import('./TimeField.h5.scss')),
      ])
      if (!mounted.current || latest.current.disabled) return
      const release = lockTimePickerScroll()
      const host = document.createElement('div')
      document.body.appendChild(host)
      // Keep Taro page-level pull-to-refresh handlers out of the modal gesture path.
      const containGesture = (event: TouchEvent) => {
        if (event.cancelable) event.preventDefault()
        event.stopPropagation()
      }
      host.addEventListener('touchmove', containGesture)
      // WeUI focuses off-screen options before translating them; prevent the browser's
      // own scroll offset from being added on top of the wheel's transform.
      const resetColumnScroll = () => {
        for (const group of host.querySelectorAll<HTMLElement>('.weui-picker__group, .weui-picker__bd')) {
          if (group.scrollTop) group.scrollTop = 0
        }
      }
      host.addEventListener('focusin', resetColumnScroll)
      host.addEventListener('scroll', resetColumnScroll, true)
      let cleaned = false
      const cleanup = () => {
        if (cleaned) return
        cleaned = true
        host.removeEventListener('touchmove', containGesture)
        host.removeEventListener('focusin', resetColumnScroll)
        host.removeEventListener('scroll', resetColumnScroll, true)
        host.remove()
        release()
        close.current = undefined
        if (mounted.current) trigger.current?.focus({ preventScroll: true })
      }
      try {
        const options = {
          id: `${mode}-${Date.now()}-${Math.random()}`,
          className: 'yishan-time-picker', container: host,
          title, defaultValue: latest.current.value.split(mode === 'date' ? '-' : ':').map(Number),
          onConfirm: (result: { value: number }[]) => {
            if (mounted.current && !latest.current.disabled) {
              latest.current.onChange(mode === 'selector' ? String(result[0].value)
                : result.map((item) => String(item.value).padStart(2, '0')).join(mode === 'date' ? '-' : ':'))
            }
          },
          onClose: cleanup,
        }
        if (mode === 'date') {
          const today = new Date()
          const fallback = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
          const current = latest.current.value || fallback
          const bounded = current < latest.current.start ? latest.current.start : current > latest.current.end ? latest.current.end : current
          options.defaultValue = bounded.split('-').map(Number)
        }
        const picker = mode === 'date'
          ? weui.datePicker({ ...options, start: latest.current.start, end: latest.current.end })
          : mode === 'selector'
            ? weui.picker(selectorPickerItems(latest.current.range), {
              ...options, defaultValue: [Math.max(0, Math.min(Number(latest.current.value) || 0, latest.current.range.length - 1))],
            })
            : weui.picker(hours, minutes, options)
        resetColumnScroll()
        const handleEscape = (event: KeyboardEvent) => {
          if (event.key === 'Escape') picker.hide()
        }
        host.addEventListener('keydown', handleEscape)
        close.current = () => {
          picker.hide()
          picker.querySelector('.weui-picker')?.dispatchEvent(new Event('animationend', { bubbles: true }))
          host.removeEventListener('keydown', handleEscape)
          cleanup()
        }
      } catch (error) {
        cleanup()
        throw error
      }
    } catch {
      if (mounted.current) void Taro.showToast({ title: `${title}加载失败，请重试`, icon: 'none' })
    } finally {
      pending.current = false
    }
  }

  return (
    <button type="button" className={`${className || styles.dateField} yishan-time-trigger`} ref={trigger}
      style={{ border: 0, background: 'var(--color-transparent)', margin: 0, padding: 0, font: 'inherit', color: 'inherit', width: '100%' }}
      aria-label={`${title}，当前 ${displayValue || '未选择'}`} disabled={disabled || (mode === 'selector' && !range.length)} onClick={() => void open()}>
      {children ?? <PickerValue value={displayValue} placeholder={placeholder || title} />}
    </button>
  )
}
