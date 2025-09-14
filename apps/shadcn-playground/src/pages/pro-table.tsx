import { useState } from 'react'
import { ProTable, Button } from '@zerocmf/yishan-shadcn'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ProColumns
} from '@zerocmf/yishan-shadcn'
import { MoreHorizontal } from 'lucide-react'

export default function ProTablePage() {
  const [exampleType, setExampleType] = useState<'static' | 'request'>('static')

  interface Payment {
    id: string
    amount: number
    status: string
    email: string
    customer: string
    date: string
  }

  function getData(): Payment[] {
    return Array.from({ length: 100 }, (_, i) => ({
      id: `payment-${i + 1}`,
      amount: Math.floor(Math.random() * 1000) + 50,
      status: ["pending", "processing", "success", "failed"][Math.floor(Math.random() * 4)],
      email: `user${i + 1}@example.com`,
      customer: `Customer ${i + 1}`,
      date: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toLocaleDateString()
    }))
  }

  const columns: ProColumns[] = [
    {
      dataIndex: "id",
      title: "ID",
    },
    {
      dataIndex: "customer",
      title: "客户",
    },
    {
      dataIndex: "email",
      title: "邮箱",
    },
    {
      dataIndex: "amount",
      title: "金额",
    },
    {
      dataIndex: "status",
      title: "状态",
    },
    {
      dataIndex: "date",
      title: "日期",
    },
    {
      dataIndex: "actions",
      title: "操作",
      cell: ({ row }) => {
        const payment = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(payment.id)}
              >
                Copy payment ID
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>View customer</DropdownMenuItem>
              <DropdownMenuItem>View payment details</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    }
  ]

  // 模拟 API 请求
  const requestData = async (params: any) => {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 1000))

    const allData = getData()
    const { current, pageSize } = params

    // 计算分页数据
    const startIndex = (current - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedData = allData.slice(startIndex, endIndex)

    return {
      data: paginatedData,
      success: true,
      total: allData.length,
    }
  }

  // 静态数据示例
  const staticData = getData().slice(0, 50)

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">ProTable 组件演示</h1>
        <p className="text-muted-foreground">
          展示 ProTable 与 ProPagination 的完整集成使用，包括数据展示、分页控制、操作菜单等功能
        </p>
      </div>

      {/* 示例切换按钮 */}
      <div className="flex gap-4 mb-6">
        <Button
          variant={exampleType === 'static' ? 'default' : 'outline'}
          onClick={() => setExampleType('static')}
        >
          静态数据示例
        </Button>
        <Button
          variant={exampleType === 'request' ? 'default' : 'outline'}
          onClick={() => setExampleType('request')}
        >
          Request API 示例
        </Button>
      </div>

      {exampleType === 'static' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">静态数据表格</h2>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              刷新数据
            </Button>
          </div>
          <div className="border rounded-lg">
            <ProTable dataSource={staticData} columns={columns} />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Request API 数据表格</h2>
            <div className="text-sm text-muted-foreground">
              使用 request API 异步获取数据，支持分页和加载状态
            </div>
          </div>
          <div className="border rounded-lg">
            <ProTable
              request={requestData}
              columns={columns}
            />
          </div>
        </div>
      )}
    </div>
  )
}