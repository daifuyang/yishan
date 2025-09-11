import * as React from "react"
import { Button, DatePicker } from '@zerocmf/yishan-shadcn'
import { format } from "date-fns"

export default function DatePickerPage() {
  const [date, setDate] = React.useState<Date>()
  const [date2, setDate2] = React.useState<Date>()
  const [date3, setDate3] = React.useState<Date>()

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">DatePicker 日期选择器</h1>
        <p className="text-muted-foreground">用于选择日期的组件，支持自定义日期范围、禁用日期等功能。</p>
      </div>
      
      <div className="flex flex-col gap-8">
        {/* 基础使用 */}
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">基础使用</h2>
          <div className="flex items-center gap-4">
            <DatePicker
              value={date}
              onChange={setDate}
              placeholder="请选择日期"
            />
            <Button 
              variant="outline" 
              onClick={() => setDate(undefined)}
            >
              清除
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            {date ? `已选择日期: ${format(date, "yyyy-MM-dd")}` : "尚未选择日期"}
          </div>
        </div>

        {/* 带日期范围限制 */}
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">日期范围限制</h2>
          <div className="flex items-center gap-4">
            <DatePicker
              value={date2}
              onChange={setDate2}
              placeholder="选择近30天内的日期"
              minDate={new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000)}
              maxDate={new Date()}
            />
            <Button 
              variant="outline" 
              onClick={() => setDate2(undefined)}
            >
              清除
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            {date2 ? `已选择日期: ${format(date2, "yyyy-MM-dd")}` : "尚未选择日期"}
          </div>
        </div>

        {/* 禁用状态 */}
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">禁用状态</h2>
          <DatePicker
            value={date3}
            onChange={setDate3}
            placeholder="禁用状态"
            disabled={true}
          />
          <div className="text-sm text-muted-foreground">
            当前组件已禁用，无法选择日期
          </div>
        </div>
      </div>
    </div>
  )
}