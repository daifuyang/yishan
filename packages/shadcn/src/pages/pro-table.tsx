import { useState } from 'react'
import { ProTable, ProPagination } from '@/index'
import type { ColumnDef } from '@tanstack/react-table'

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

export default function ProTablePage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

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

  const columns: ColumnDef<Payment>[] = [
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("id")}</span>
    },
    {
      accessorKey: "customer",
      header: "Customer",
      cell: ({ row }) => <span className="font-medium">{row.getValue("customer")}</span>
    },
    {
      accessorKey: "email",
      header: "Email",
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
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string
        const statusColors: Record<string, string> = {
          pending: "bg-yellow-100 text-yellow-800",
          processing: "bg-blue-100 text-blue-800",
          success: "bg-green-100 text-green-800",
          failed: "bg-red-100 text-red-800",
        }
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status] || "bg-gray-100 text-gray-800"}`}>
            {status}
          </span>
        )
      },
    },
    {
      accessorKey: "date",
      header: "Date",
    },
    {
      id: "actions",
      header: "Actions",
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
      const newTotalPages = Math.ceil(allData.length / newPageSize)
      if (page > newTotalPages) {
        setCurrentPage(newTotalPages || 1)
      }
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">ProTable 组件演示</h1>
        <p className="text-muted-foreground">
          展示 ProTable 与 ProPagination 的完整集成使用，包括数据展示、分页控制、操作菜单等功能
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-medium text-muted-foreground">总记录数</h3>
          <p className="text-2xl font-bold">{allData.length}</p>
        </div>
        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-medium text-muted-foreground">当前页</h3>
          <p className="text-2xl font-bold">{currentPage}</p>
        </div>
        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-medium text-muted-foreground">每页条数</h3>
          <p className="text-2xl font-bold">{pageSize}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">数据表格</h2>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            刷新数据
          </Button>
        </div>
        <div className="border rounded-lg">
          <ProTable data={paginatedData} columns={columns} />
        </div>
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
              <span className="text-sm">
                显示 {range[0]}-{range[1]} 条，共 {total} 条
              </span>
            )}
            align="center"
          />
        </div>
      </div>
    </div>
  )
}