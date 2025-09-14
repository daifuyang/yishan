"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState, useEffect, useMemo } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton"
import { Inbox } from "lucide-react";
import { QueryFilter } from "../queryFilter";
import { ProPagination } from "../proPagination";
import { ProColumns } from "@/types/proTable";

// Request types based on official example
interface RequestParams {
  pageSize: number;
  current: number;
  [key: string]: any;
}

interface RequestData<TData> {
  data: TData[];
  success: boolean;
  total?: number;
}

interface RequestOptions<TData, TParams = any> {
  dataSource?: TData[];
  data?: TData[];
  params?: TParams;
  request?: (
    params: RequestParams & TParams,
    sort: any,
    filter: any
  ) => Promise<RequestData<TData>>;
}

interface DataTableProps<TData, TValue> extends RequestOptions<TData> {
  columns: ProColumns[];
}

function ProTable<TData, TValue>({
  columns,
  data: deprecatedData = [],
  dataSource = [],
  params = {},
  request,
}: DataTableProps<TData, TValue>) {
  // 统一数据来源
  const sourceData = useMemo(() => 
    dataSource.length > 0 ? dataSource : deprecatedData,
    [dataSource, deprecatedData]
  );
  
  // 判断是否为服务端分页
  const isServerSide = !!request;
  
  // 使用TanStack Table的分页状态
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  
  const [data, setData] = useState<TData[]>([]);
  const [loading, setLoading] = useState(isServerSide); // 服务端模式下初始为加载状态
  const [total, setTotal] = useState(0);
  const [isFirstLoad, setIsFirstLoad] = useState(isServerSide); // 标记首次加载

  // 转换列定义
  const tableColumns = useMemo(() => 
    columns.map((column) => ({
      header: column.title,
      accessorKey: column.dataIndex,
      ...column,
    })),
    [columns]
  );

  // 服务端数据获取
  const fetchServerData = async () => {
    if (!isServerSide) return;
    
    setLoading(true);
    try {
      const response = await request(
        {
          current: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
          ...params,
        },
        {},
        {}
      );

      if (response.success) {
        setData(response.data);
        setTotal(response.total ?? response.data.length);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
      setIsFirstLoad(false); // 首次加载完成
    }
  };

  // 设置总数据量（客户端分页）
  useEffect(() => {
    if (!isServerSide) {
      setTotal(sourceData.length);
    }
  }, [sourceData.length, isServerSide]);

  // 服务端数据获取
  useEffect(() => {
    if (isServerSide) {
      fetchServerData();
    }
  // 首次加载时也需要触发数据获取
  }, [isServerSide, pagination.pageIndex, pagination.pageSize, JSON.stringify(params)]);

  // 统一的数据源：服务端数据 或 客户端分页数据
  const displayData = useMemo(() => {
    if (isServerSide) {
      return data;
    }
    
    // 客户端分页：使用TanStack Table的内置分页
    return sourceData;
  }, [data, sourceData, isServerSide]);

  console.log('displayData', displayData);

  // 创建TanStack Table实例
  const table = useReactTable({
    data: displayData,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    
    // 根据数据源选择分页模式
    ...(isServerSide 
      ? {
          // 服务端分页：手动分页模式
          manualPagination: true,
          pageCount: Math.ceil(total / pagination.pageSize),
        }
      : {
          // 客户端分页：使用内置分页
          getPaginationRowModel: getPaginationRowModel(),
        }
    ),
    
    state: {
      pagination,
    },
    onPaginationChange: setPagination,
  });

  // 获取当前显示的数据（客户端分页时自动处理）
  const currentDisplayData = isServerSide 
    ? table.getRowModel().rows
    : table.getPaginationRowModel().rows;

  // 判断是否应该显示空数据状态
  const shouldShowEmpty = !loading && currentDisplayData.length === 0 && !isFirstLoad;

  return (
    <div className="w-full p-6">
      <div className="mb-8"><QueryFilter columns={columns} /></div>
      <div className="border-t border-b mb-8">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {currentDisplayData.length > 0 ? (
              currentDisplayData.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : shouldShowEmpty ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="rounded-full bg-muted p-3">
                      <Inbox className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">暂无数据</div>
                      <div className="text-xs text-muted-foreground">当前没有可显示的数据</div>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <ProPagination
        align="end"
        current={table.getState().pagination.pageIndex + 1}
        pageSize={table.getState().pagination.pageSize}
        total={total}
        showSizeChanger
        showTotal={(total, range) => (
          <span className="text-sm">
            第 {range[0]}-{range[1]} 条，总共 {total} 条
          </span>
        )}
        onChange={(page, pageSize) => {
          table.setPagination({
            pageIndex: page - 1,
            pageSize: pageSize || pagination.pageSize,
          });
        }}
      />

    </div>
  );
}

export { ColumnDef, ProTable };
