import React, { useState, useEffect, useMemo } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Clock, ChevronDown, ChevronUp, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// 类型定义
type Breakpoint = "sm" | "md" | "lg" | "xl" | "2xl";

// 表单数据类型
interface FormData {
  [key: string]: string;
}

// 列配置类型
export interface ColumnConfig {
  key: string;
  label: string;
  type:
    | "input"
    | "select"
    | "email"
    | "tel"
    | "date"
    | "time"
    | "dateTime"
    | "dateRange"
    | "dateTimeRange";
  placeholder?: string;
  options?: { label: string; value: string }[];
  required?: boolean;
  pattern?: {
    value: RegExp;
    message: string;
  };
}

export interface QueryFilterProps {
  columns: ColumnConfig[];
  defaultCollapsed?: boolean;
  hideRequiredMark?: boolean;
  labelWidth?: number | "auto";
  span?: number;
  className?: string;
  style?: React.CSSProperties;
  onSubmit?: (data: FormData) => void;
  onReset?: () => void;
}

// 常量配置
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

const RESPONSIVE_COLUMNS: Record<Breakpoint, number> = {
  sm: 1,
  md: 2,
  lg: 3,
  xl: 4,
  "2xl": 4,
};

const GRID_CLASSES: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

// 自定义 Hooks
const useBreakpoint = (): Breakpoint => {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("sm");

  useEffect(() => {
    const calculateBreakpoint = () => {
      const width = window.innerWidth;
      let newBreakpoint: Breakpoint;

      if (width >= BREAKPOINTS["2xl"]) {
        newBreakpoint = "2xl";
      } else if (width >= BREAKPOINTS.xl) {
        newBreakpoint = "xl";
      } else if (width >= BREAKPOINTS.lg) {
        newBreakpoint = "lg";
      } else if (width >= BREAKPOINTS.md) {
        newBreakpoint = "md";
      } else {
        newBreakpoint = "sm";
      }
      setBreakpoint(newBreakpoint);
    };

    // 初始计算
    calculateBreakpoint();

    // 添加 resize 事件监听器
    window.addEventListener("resize", calculateBreakpoint);

    // 清理函数
    return () => {
      window.removeEventListener("resize", calculateBreakpoint);
    };
  }, []);

  return breakpoint;
};

const useResponsiveConfig = (props: QueryFilterProps) => {
  const breakpoint = useBreakpoint();
  const colsNumber = RESPONSIVE_COLUMNS[breakpoint];

  const labelWidth = useMemo(() => {
    if (props.labelWidth === "auto") return "auto";

    const widths: Record<Breakpoint, number> = {
      sm: Math.min(props.labelWidth as number, 60),
      md: Math.min(props.labelWidth as number, 70),
      lg: props.labelWidth as number,
      xl: props.labelWidth as number,
      "2xl": props.labelWidth as number,
    };

    return widths[breakpoint];
  }, [props.labelWidth, breakpoint]);

  return {
    breakpoint,
    colsNumber,
    labelWidth,
    gridClass: GRID_CLASSES[colsNumber],
  };
};

export default function QueryFilter({
  columns = [],
  defaultCollapsed = true,
  hideRequiredMark = true,
  labelWidth = 80,
  className,
  style,
  onSubmit,
  onReset,
}: QueryFilterProps) {
  const {
    gridClass,
    colsNumber,
    labelWidth: computedLabelWidth,
  } = useResponsiveConfig({
    defaultCollapsed,
    hideRequiredMark,
    labelWidth,
    columns,
  });

  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    getValues,
    reset,
    watch,
  } = useForm<FormData>();

  const onFormSubmit: SubmitHandler<FormData> = (data) => {
    onSubmit?.(data);
    console.log("表单数据:", data);
  };

  const handleReset = () => {
    reset();
    onReset?.();
  };

  const containerClass = ["grid gap-4", gridClass, className]
    .filter(Boolean)
    .join(" ");

  const renderField = (column: ColumnConfig) => {
    const { key, label, type, placeholder, options, required, pattern } =
      column;

    switch (type) {
      case "select":
        return (
          <Select key={key} onValueChange={(value) => setValue(key, value)}>
            <SelectTrigger id={key} className="w-full">
              <SelectValue placeholder={placeholder || `请选择${label}`} />
            </SelectTrigger>
            <SelectContent>
              {options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "date":
      case "dateTime":
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Input
                id={key}
                type="text"
                readOnly
                placeholder={placeholder || `请选择${label}`}
                value={watch(key)
                  ? type === "dateTime"
                    ? format(new Date(watch(key)), "yyyy-MM-dd HH:mm:ss")
                    : format(new Date(watch(key)), "yyyy-MM-dd")
                  : ""}
                className="w-full cursor-pointer"
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={watch(key) ? new Date(watch(key)) : undefined}
                onSelect={(date) => {
                  setValue(key, date ? date.toISOString() : "");
                  // 点击后立即关闭弹窗
                  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
                  document.dispatchEvent(event);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );

      case "time":
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Input
                id={key}
                type="text"
                readOnly
                placeholder={placeholder || `请选择${label}`}
                value={watch(key) ? format(new Date(watch(key)), "HH:mm") : ""}
                className="w-full cursor-pointer"
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <div className="p-3">
                <Input
                  type="time"
                  value={watch(key) ? format(new Date(watch(key)), "HH:mm") : ""}
                  onChange={(e) => {
                    const [hours, minutes] = e.target.value.split(":");
                    const date = new Date();
                    date.setHours(parseInt(hours), parseInt(minutes));
                    setValue(key, date.toISOString());
                    // 点击后立即关闭弹窗
                    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
                    document.dispatchEvent(event);
                  }}
                  className="w-full"
                />
              </div>
            </PopoverContent>
          </Popover>
        );

      case "dateRange":
      case "dateTimeRange":
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Input
                id={key}
                type="text"
                readOnly
                placeholder={placeholder || `请选择${label}`}
                value={(() => {
                  const value = watch(key);
                  if (!value) return "";
                  try {
                    const range = typeof value === 'string' ? JSON.parse(value) : value;
                    if (range?.from && range?.to) {
                      const formatStr = type === "dateTimeRange" 
                        ? "yyyy年M月d日 HH:mm" 
                        : "yyyy年M月d日";
                      return `${format(new Date(range.from), formatStr)} 至 ${format(new Date(range.to), formatStr)}`;
                    }
                  } catch {
                    return "";
                  }
                  return "";
                })()}
                className="w-full cursor-pointer"
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="range"
                selected={(() => {
                  const value = watch(key);
                  if (!value) return undefined;
                  try {
                    return typeof value === 'string' ? JSON.parse(value) : value;
                  } catch {
                    return undefined;
                  }
                })()}
                onSelect={(range) => {
                  setValue(key, range ? JSON.stringify(range) : "");
                  // 点击后立即关闭弹窗（范围选择器在选择完整范围后关闭）
                  if (range?.from && range?.to) {
                    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
                    document.dispatchEvent(event);
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );

      case "input":
      case "email":
      case "tel":
      default:
        return (
          <Input
            id={key}
            type={type}
            placeholder={placeholder || `请输入${label}`}
            {...register(key, {
              required: required && !hideRequiredMark,
              pattern,
            })}
            className="w-full"
          />
        );
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onFormSubmit)}
      className={containerClass}
      style={style}
    >
      {columns.map((column, i) => {
        if (collapsed && i >= colsNumber - 1) {
          return null;
        }
        return (
          <div key={column.key} className="space-y-2">
            <Label
              htmlFor={column.key}
              className="text-sm font-medium flex items-center"
              style={{ width: computedLabelWidth }}
            >
              {column.label}
              {!hideRequiredMark && column.required && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </Label>
            {renderField(column)}
            {errors[column.key] && (
              <span className="text-red-500 text-xs">
                {errors[column.key]?.message || `${column.label}不能为空`}
              </span>
            )}
          </div>
        );
      })}

      {/* 操作按钮 */}
      <div className="col-start-4 flex items-end justify-end">
        <div className="flex items-center gap-2">
          <Button className="cursor-pointer" type="submit">
            查询
          </Button>
          <Button
            className="cursor-pointer"
            type="button"
            variant="outline"
            onClick={handleReset}
          >
            重置
          </Button>

          <div
            className="flex items-center cursor-pointer"
            onClick={() => setCollapsed(!collapsed)}
          >
            <span>{collapsed ? "展开" : "收起"}</span>
            {collapsed ? <ChevronDown /> : <ChevronUp />}
          </div>
        </div>
      </div>
    </form>
  );
}
