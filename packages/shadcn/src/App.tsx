import { ProTable, ProPagination } from '@/index'
import './App.css'
import type { ColumnDef } from '@tanstack/react-table'
import { useState } from 'react'

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from 'lucide-react'

function App() {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  interface Payment {
    id: string
    amount: number
    status: string
    email: string
  }

  function getData(): Payment[] {
    // 模拟更多数据用于分页测试
    return Array.from({ length: 100 }, (_, i) => ({
      id: `payment-${i + 1}`,
      amount: Math.floor(Math.random() * 1000) + 50,
      status: ["pending", "processing", "success", "failed"][Math.floor(Math.random() * 4)],
      email: `user${i + 1}@example.com`,
    }))
  }

  const columns: ColumnDef<Payment>[] = [
    {
      accessorKey: "status",
      header: "Status",
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "amount",
      header: "Amount",
    },
    {
      accessorKey: "amount",
      header: () => <div className="text-right">Amount</div>,
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("amount"))
        const formatted = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(amount)

        return <div className="text-right font-medium">{formatted}</div>
      },
    },
    {
      id: "actions",
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

  const allData = getData()
  const paginatedData = allData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const handlePageChange = (page: number, newPageSize?: number) => {
    setCurrentPage(page)
    if (newPageSize) {
      setPageSize(newPageSize)
      // 重新计算页码
      const newTotalPages = Math.ceil(allData.length / newPageSize)
      if (page > newTotalPages) {
        setCurrentPage(newTotalPages || 1)
      }
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">ProPagination 组件测试</h1>
        <p className="text-muted-foreground">测试 ProPagination 与 ProTable 的集成使用</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">数据表格</h2>
        <ProTable data={paginatedData} columns={columns} />
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">分页控制</h2>
        <div className="border rounded-lg p-4">
          <ProPagination
            current={currentPage}
            pageSize={pageSize}
            total={allData.length}
            onChange={handlePageChange}
            showSizeChanger
            showQuickJumper
            showTotal={(total, range) => (
              <span>
                显示 {range[0]}-{range[1]} 条，共 {total} 条
              </span>
            )}
            align="center"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">简单模式</h3>
          <div className="border rounded-lg p-4">
            <ProPagination total={50} simple />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-semibold">小尺寸</h3>
          <div className="border rounded-lg p-4">
            <ProPagination total={30} size="small" showSizeChanger />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
