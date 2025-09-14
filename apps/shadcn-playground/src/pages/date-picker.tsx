import * as React from "react"
import { DatePicker } from '@zerocmf/yishan-shadcn'
import {  Clock } from 'lucide-react'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker;

export default function DatePickerPage() {
  const [date, setDate] = React.useState<dayjs.Dayjs>()
  const [date2, setDate2] = React.useState<dayjs.Dayjs>()
  const [date3, setDate3] = React.useState<dayjs.Dayjs>()
  const [date4, setDate4] = React.useState<dayjs.Dayjs>()
  const [date5, setDate5] = React.useState<dayjs.Dayjs>()
  const [rangeDate] = React.useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const [rangeDate2] = React.useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const [rangeDate3] = React.useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const [rangeDate4] = React.useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const [rangeDate5] = React.useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const [rangeDate6] = React.useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">DatePicker 日期选择器</h1>
        <p className="text-muted-foreground">基于 rc-picker 的日期选择组件，支持多种配置选项。</p>
      </div>
      
      <div className="flex flex-col gap-8">
        {/* 基础使用 */}
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">基础使用</h2>
          <div className="flex items-center gap-4">
            <DatePicker 
              // open={true}
              placeholder="请选择日期"
              value={date}
              onChange={setDate}
              picker="time"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            默认的日期选择器，picker="date"，支持中文界面和清除功能
          </div>
        </div>

              <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">日期选择器</h2>
          <div className="flex items-center gap-4">
            <DatePicker 
              picker="date"
              placeholder="请选择日期"
              value={date2}
              onChange={setDate2}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            设置 picker="date" 来选择日期
          </div>
        </div>

        {/* 月份选择器 */}
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">月份选择器</h2>
          <div className="flex items-center gap-4">
            <DatePicker 
              picker="month"
              placeholder="请选择月份"
              value={date3}
              onChange={setDate3}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            设置 picker="month" 来选择月份
          </div>
        </div>

        {/* 年份选择器 */}
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">年份选择器</h2>
          <div className="flex items-center gap-4">
            <DatePicker 
              picker="year"
              placeholder="请选择年份"
              value={date}
              onChange={setDate}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            设置 picker="year" 来选择年份
          </div>
        </div>

        {/* 自定义图标 */}
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">自定义图标</h2>
          <div className="flex items-center gap-4">
            <DatePicker 
              placeholder="自定义时钟图标"
              suffixIcon={<Clock className="w-4 h-4" />}
              value={date4}
              onChange={setDate4}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            通过 suffixIcon 属性自定义后缀图标
          </div>
        </div>

        {/* 禁用清除按钮 */}
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">禁用清除按钮</h2>
          <div className="flex items-center gap-4">
            <DatePicker 
              placeholder="无清除按钮"
              allowClear={false}
              value={date5}
              onChange={setDate5}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            设置 allowClear={false} 禁用清除按钮
          </div>
        </div>

        {/* RangePicker 示例 */}
        <div className="flex flex-col gap-8">
          <h2 className="text-2xl font-semibold">RangePicker 日期范围选择器</h2>
          
          {/* 基础 RangePicker */}
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-medium">基础日期范围选择</h3>
            <div className="flex items-center gap-4">
              <RangePicker 
                value={rangeDate}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              基础的日期范围选择器
            </div>
          </div>

          {/* 带时间的 RangePicker */}
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-medium">带时间选择</h3>
            <div className="flex items-center gap-4">
              <RangePicker 
                showTime
                value={rangeDate2}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              设置 showTime 属性可以同时选择日期和时间
            </div>
          </div>

          {/* 周选择 RangePicker */}
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-medium">周范围选择</h3>
            <div className="flex items-center gap-4">
              <RangePicker 
                picker="week"
                value={rangeDate3}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              设置 picker="week" 来选择周范围
            </div>
          </div>

          {/* 月份选择 RangePicker */}
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-medium">月份范围选择</h3>
            <div className="flex items-center gap-4">
              <RangePicker 
                picker="month"
                value={rangeDate4}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              设置 picker="month" 来选择月份范围
            </div>
          </div>

          {/* 季度选择 RangePicker */}
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-medium">季度范围选择</h3>
            <div className="flex items-center gap-4">
              <RangePicker 
                picker="quarter"
                value={rangeDate5}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              设置 picker="quarter" 来选择季度范围
            </div>
          </div>

          {/* 年份选择 RangePicker 带事件处理 */}
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-medium">年份范围选择（带事件处理）</h3>
            <div className="flex items-center gap-4">
              <RangePicker 
                picker="year"
                value={rangeDate6}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              设置 picker="year" 来选择年份范围，支持自定义 id 和焦点事件处理
            </div>
          </div>
        </div>

        {/* 支持的 Props */}
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">支持的 Props</h2>
          <div className="bg-muted p-4 rounded-lg">
            <div className="space-y-2 text-sm">
              <p><code className="bg-background px-1 rounded">locale</code>: 本地化配置，默认为中文 (zhCN)</p>
              <p><code className="bg-background px-1 rounded">allowClear</code>: 是否显示清除按钮，默认为 true</p>
              <p><code className="bg-background px-1 rounded">suffixIcon</code>: 自定义后缀图标，默认为日历图标</p>
              <p><code className="bg-background px-1 rounded">open</code>: 控制面板打开状态，默认为 true</p>
              <p><code className="bg-background px-1 rounded">picker</code>: 选择器类型，支持 'date' | 'month' | 'year' | 'time' | 'week' | 'quarter'，默认为 'date'</p>
              <p><code className="bg-background px-1 rounded">showTime</code>: RangePicker 是否显示时间选择</p>
              <p><code className="bg-background px-1 rounded">separator</code>: RangePicker 分隔符，默认为 '~'</p>
              <p className="text-muted-foreground mt-2">同时支持 rc-picker 的所有其他 props，如 value、onChange、placeholder、disabled 等</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}