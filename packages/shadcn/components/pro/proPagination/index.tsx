"use client";

import { useState, useEffect, forwardRef, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  ChevronDown,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ProPaginationProps {
  /** 当前页数 */
  current?: number;
  /** 默认当前页数 */
  defaultCurrent?: number;
  /** 数据总数 */
  total?: number;
  /** 每页条数 */
  pageSize?: number;
  /** 默认每页条数 */
  defaultPageSize?: number;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否显示每页条数选择器 */
  showSizeChanger?: boolean;
  /** 是否显示快速跳转 */
  showQuickJumper?: boolean;
  /** 是否显示总条数 */
  showTotal?: boolean | ((total: number, range: [number, number]) => ReactNode);
  /** 页码或 pageSize 改变的回调 */
  onChange?: (page: number, pageSize?: number) => void;
  /** pageSize 变化的回调 */
  onShowSizeChange?: (current: number, size: number) => void;
  /** 指定每页可以显示多少条 */
  pageSizeOptions?: string[] | number[];
  /** 当添加该属性时，显示为简单分页 */
  simple?: boolean;
  /** 当添加该属性时，显示为小尺寸分页 */
  size?: "default" | "small";
  /** 当只有一页时是否隐藏分页器 */
  hideOnSinglePage?: boolean;
  /** 自定义渲染页码 */
  itemRender?: (
    page: number,
    type: "page" | "prev" | "next" | "jump-prev" | "jump-next",
    originalElement: ReactNode
  ) => ReactNode;
  /** 指定分页显示的位置 */
  align?: "start" | "center" | "end";
  className?: string;
}

const ProPagination = forwardRef<HTMLDivElement, ProPaginationProps>(
  (
    {
      current,
      defaultCurrent = 1,
      total = 0,
      pageSize = 10,
      defaultPageSize = 10,
      disabled = false,
      showSizeChanger = false,
      showQuickJumper = false,
      showTotal = false,
      onChange,
      onShowSizeChange,
      pageSizeOptions = [10, 20, 50, 100],
      simple = false,
      size = "default",
      hideOnSinglePage = false,
      itemRender,
      align = "start",
      className,
      ...props
    },
    ref
  ) => {
    const [internalCurrent, setInternalCurrent] = useState(
      current ?? defaultCurrent
    );
    const [internalPageSize, setInternalPageSize] = useState(
      pageSize ?? defaultPageSize
    );

    const controlledCurrent = current !== undefined ? current : internalCurrent;
    const controlledPageSize =
      pageSize !== undefined ? pageSize : internalPageSize;

    const totalPages = Math.max(1, Math.ceil(total / controlledPageSize));

    useEffect(() => {
      if (current !== undefined) {
        setInternalCurrent(current);
      }
    }, [current]);

    useEffect(() => {
      if (pageSize !== undefined) {
        setInternalPageSize(pageSize);
      }
    }, [pageSize]);

    const handlePageChange = (page: number) => {
      if (page < 1 || page > totalPages) return;

      if (current === undefined) {
        setInternalCurrent(page);
      }
      onChange?.(page, controlledPageSize);
    };

    const handlePageSizeChange = (size: number) => {
      const newTotalPages = Math.max(1, Math.ceil(total / size));
      const newCurrent = Math.min(controlledCurrent, newTotalPages);

      if (pageSize === undefined) {
        setInternalPageSize(size);
      }
      if (current === undefined) {
        setInternalCurrent(newCurrent);
      }

      onShowSizeChange?.(newCurrent, size);
      onChange?.(newCurrent, size);
    };

    const renderPageNumbers = () => {
      const pages: ReactNode[] = [];
      const maxPagesToShow = 7;

      if (totalPages <= maxPagesToShow) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(
            <Button
              key={i}
              variant={controlledCurrent === i ? "default" : "outline"}
              size={size === "small" ? "sm" : "default"}
              disabled={disabled}
              onClick={() => handlePageChange(i)}
              className={cn(
                "cursor-pointer min-w-8",
                controlledCurrent === i && "border bg-primary text-primary-foreground"
              )}
            >
              {itemRender ? itemRender(i, "page", <>{i}</>) : i}
            </Button>
          );
        }
      } else {
        let startPage = Math.max(1, controlledCurrent - 2);
        let endPage = Math.min(totalPages, controlledCurrent + 2);

        if (controlledCurrent <= 3) {
          endPage = 5;
        } else if (controlledCurrent >= totalPages - 2) {
          startPage = totalPages - 4;
        }

        if (startPage > 1) {
          pages.push(
            <Button
              key={1}
              variant="outline"
              size={size === "small" ? "sm" : "default"}
              disabled={disabled}
              onClick={() => handlePageChange(1)}
              className="min-w-8 cursor-pointer"
            >
              {itemRender ? itemRender(1, "page", <>1</>) : 1}
            </Button>
          );
          if (startPage > 2) {
            pages.push(
              <span key="start-ellipsis" className="flex items-center px-1">
                <MoreHorizontal className="h-4 w-4" />
              </span>
            );
          }
        }

        for (let i = startPage; i <= endPage; i++) {
          pages.push(
            <Button
              key={i}
              variant={controlledCurrent === i ? "default" : "outline"}
              size={size === "small" ? "sm" : "default"}
              disabled={disabled}
              onClick={() => handlePageChange(i)}
              className={cn(
                "min-w-8 cursor-pointer",
                controlledCurrent === i && "bg-primary text-primary-foreground"
              )}
            >
              {itemRender ? itemRender(i, "page", <>{i}</>) : i}
            </Button>
          );
        }

        if (endPage < totalPages) {
          if (endPage < totalPages - 1) {
            pages.push(
              <span key="end-ellipsis" className="flex items-center px-1">
                <MoreHorizontal className="h-4 w-4" />
              </span>
            );
          }
          pages.push(
            <Button
              key={totalPages}
              variant="outline"
              size={size === "small" ? "sm" : "default"}
              disabled={disabled}
              onClick={() => handlePageChange(totalPages)}
              className="min-w-8 cursor-pointer"
            >
              {itemRender
                ? itemRender(totalPages, "page", <>{totalPages}</>)
                : totalPages}
            </Button>
          );
        }
      }

      return pages;
    };

    const renderTotal = () => {
      if (!showTotal) return null;

      const start = (controlledCurrent - 1) * controlledPageSize + 1;
      const end = Math.min(controlledCurrent * controlledPageSize, total);

      if (typeof showTotal === "function") {
        return showTotal(total, [start, end]);
      }

      return (
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
      );
    };

    const renderSimplePagination = () => (
      <div className="flex items-center gap-2">
        <Button
            variant="outline"
            size={size === "small" ? "sm" : "default"}
            className="disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled || controlledCurrent <= 1}
            onClick={() => handlePageChange(controlledCurrent - 1)}
          >
          {itemRender ? (
            itemRender(
              controlledCurrent - 1,
              "prev",
              <ChevronLeft className="h-4 w-4" />
            )
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
        <span className="text-sm">
          {controlledCurrent} / {totalPages}
        </span>
        <Button
          variant="outline"
          size={size === "small" ? "sm" : "default"}
          className="disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled || controlledCurrent >= totalPages}
          onClick={() => handlePageChange(controlledCurrent + 1)}
        >
          {itemRender ? (
            itemRender(
              controlledCurrent + 1,
              "next",
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>
    );

    const renderQuickJumper = () => {
      if (!showQuickJumper) return null;

      return (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">跳至</span>
          <Input
            type="number"
            min={1}
            max={totalPages}
            defaultValue={controlledCurrent}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const value = parseInt((e.target as HTMLInputElement).value);
                if (!isNaN(value) && value >= 1 && value <= totalPages) {
                  handlePageChange(value);
                }
              }
            }}
            className={cn(
              "w-16 h-8 text-center",
              size === "small" ? "h-7 text-sm" : "h-8"
            )}
            disabled={disabled}
          />
          <span className="text-sm text-muted-foreground">页</span>
        </div>
      );
    };

    if (hideOnSinglePage && totalPages <= 1) {
      return null;
    }

    if (simple) {
      return (
        <div
          ref={ref}
          className={cn(
            "flex items-center gap-4",
            align === "center" && "justify-center",
            align === "end" && "justify-end",
            className
          )}
          {...props}
        >
          {renderSimplePagination()}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-4 flex-wrap",
          align === "center" && "justify-center",
          align === "end" && "justify-end",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-2">
          {renderTotal()}

          <Button
            variant="outline"
            size={size === "small" ? "sm" : "default"}
            className="cursor-pointer disabled:pointer-events-auto disabled:cursor-not-allowed"
            disabled={disabled || controlledCurrent <= 1}
            onClick={() => handlePageChange(controlledCurrent - 1)}
          >
            {itemRender ? (
              itemRender(
                controlledCurrent - 1,
                "prev",
                <ChevronLeft className="h-4 w-4" />
              )
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>

          <div className="flex items-center gap-1">{renderPageNumbers()}</div>

          <Button
            variant="outline"
            size={size === "small" ? "sm" : "default"}
            className="cursor-pointer disabled:pointer-events-auto disabled:cursor-not-allowed"
            disabled={disabled || controlledCurrent >= totalPages}
            onClick={() => handlePageChange(controlledCurrent + 1)}
          >
            {itemRender ? (
              itemRender(
                controlledCurrent + 1,
                "next",
                <ChevronRight className="h-4 w-4" />
              )
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {showSizeChanger && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size={size === "small" ? "sm" : "default"}
                  disabled={disabled}
                  className={cn(
                    "justify-between disabled:pointer-events-auto disabled:cursor-not-allowed",
                    size === "small" ? "h-7 px-2 text-xs" : "h-8 px-3"
                  )}
                >
                  {controlledPageSize} 条/页
                  <ChevronDown
                    className={cn(
                      "ml-1 h-3 w-3 opacity-50",
                      size === "small" ? "h-3 w-3" : "h-4 w-4"
                    )}
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {pageSizeOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.toString()}
                    onSelect={() => handlePageSizeChange(Number(option))}
                    className={cn(
                      "text-sm",
                      Number(option) === controlledPageSize && "bg-accent"
                    )}
                  >
                    {option} 条/页
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {renderQuickJumper()}
        </div>
      </div>
    );
  }
);

ProPagination.displayName = "ProPagination";

export { ProPagination };
