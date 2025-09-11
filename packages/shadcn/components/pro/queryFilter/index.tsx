import { useState, useEffect, useMemo, useRef } from "react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

// 类型定义
type Breakpoint = "xs" | "sm" | "md" | "lg";

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
  layout?: "vertical" | "horizontal"; // 添加layout属性，默认为vertical
  className?: string;
  style?: React.CSSProperties;
  onSubmit?: (data: FormData) => void;
  onReset?: () => void;
}

// 常量配置
const BREAKPOINTS = {
  xs: 0,
  sm: 513,
  md: 785,
  lg: 1057,
} as const;

const RESPONSIVE_COLUMNS: Record<Breakpoint, number> = {
  xs: 1,
  sm: 2,
  md: 3,
  lg: 4,
} as const;

const getGridClass = (cols: number): string => {
  const gridMap: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-2", 
    3: "grid-cols-3",
    4: "grid-cols-4",
  };
  return gridMap[cols] || "grid-cols-1";
};

const getColStartClass = (cols: number): string => {
  const colStartMap: Record<number, string> = {
    1: "col-start-1",
    2: "col-start-2",
    3: "col-start-3", 
    4: "col-start-4",
  };
  return colStartMap[cols] || "col-start-1";
};

// 自定义 Hooks
const useContainerWidth = (
  ref: React.RefObject<HTMLFormElement | null>
): number => {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    // 检查ref是否存在
    if (!ref.current) {
      return;
    }

    const calculateWidth = () => {
      if (ref.current) {
        const containerWidth = ref.current.offsetWidth;
        setWidth(containerWidth);
      }
    };

    // 初始计算
    calculateWidth();

    // 使用 ResizeObserver 监听容器尺寸变化
    const resizeObserver = new ResizeObserver(calculateWidth);
    if (ref.current) {
      resizeObserver.observe(ref.current);
    }

    // 清理函数
    return () => {
      resizeObserver.disconnect();
    };
  }, [ref]);

  return width;
};

const useResponsiveConfig = (
  props: QueryFilterProps,
  containerWidth: number
) => {
  const breakpoint = useMemo((): Breakpoint => {
    if (containerWidth >= BREAKPOINTS.lg) {
      return "lg";
    } else if (containerWidth >= BREAKPOINTS.md) {
      return "md";
    } else if (containerWidth >= BREAKPOINTS.sm) {
      return "sm";
    } else {
      // 容器宽度 < 513px
      return "xs";
    }
  }, [containerWidth]);

  const colsNumber = useMemo(() => {
    return RESPONSIVE_COLUMNS[breakpoint];
  }, [breakpoint]);

  const labelWidth = useMemo(() => {
    // 如果是vertical布局，labelWidth默认占一整行
    if (props.layout === "vertical") {
      return "100%";
    }
    
    // 只有horizontal布局时labelWidth才生效
    if (props.labelWidth === "auto") return "auto";

    const widths: Record<Breakpoint, number> = {
      xs: Math.min(props.labelWidth as number, 50),
      sm: Math.min(props.labelWidth as number, 60),
      md: Math.min(props.labelWidth as number, 70),
      lg: props.labelWidth as number,
    };

    return widths[breakpoint];
  }, [props.labelWidth, props.layout, breakpoint]);

  return {
    breakpoint,
    colsNumber,
    labelWidth,
    gridClass: getGridClass(colsNumber),
    colStartClass: getColStartClass(colsNumber),
  };
};

export default function QueryFilter({
  columns = [],
  defaultCollapsed = true,
  hideRequiredMark = true,
  labelWidth = 80,
  layout = "vertical", // 添加layout属性，默认为vertical
  className,
  style,
  onSubmit,
  onReset,
}: QueryFilterProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const containerWidth = useContainerWidth(formRef);

  const {
    gridClass,
    colStartClass,
    colsNumber,
    labelWidth: computedLabelWidth,
  } = useResponsiveConfig(
    {
      defaultCollapsed,
      hideRequiredMark,
      labelWidth,
      columns,
    },
    containerWidth
  );

  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
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
                value={
                  watch(key)
                    ? type === "dateTime"
                      ? format(new Date(watch(key)), "yyyy-MM-dd HH:mm:ss")
                      : format(new Date(watch(key)), "yyyy-MM-dd")
                    : ""
                }
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
                  const event = new KeyboardEvent("keydown", {
                    key: "Escape",
                    bubbles: true,
                  });
                  document.dispatchEvent(event);
                }}
                captionLayout="dropdown"
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
                  value={
                    watch(key) ? format(new Date(watch(key)), "HH:mm") : ""
                  }
                  onChange={(e) => {
                    const [hours, minutes] = e.target.value.split(":");
                    const date = new Date();
                    date.setHours(parseInt(hours), parseInt(minutes));
                    setValue(key, date.toISOString());
                    // 点击后立即关闭弹窗
                    const event = new KeyboardEvent("keydown", {
                      key: "Escape",
                      bubbles: true,
                    });
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
                    const range =
                      typeof value === "string" ? JSON.parse(value) : value;
                    if (range?.from && range?.to) {
                      const formatStr =
                        type === "dateTimeRange"
                          ? "yyyy年M月d日 HH:mm"
                          : "yyyy年M月d日";
                      return `${format(
                        new Date(range.from),
                        formatStr
                      )} 至 ${format(new Date(range.to), formatStr)}`;
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
                    return typeof value === "string"
                      ? JSON.parse(value)
                      : value;
                  } catch {
                    return undefined;
                  }
                })()}
                onSelect={(range) => {
                  setValue(key, range ? JSON.stringify(range) : "");
                  // 点击后立即关闭弹窗（范围选择器在选择完整范围后关闭）
                  if (range?.from && range?.to) {
                    const event = new KeyboardEvent("keydown", {
                      key: "Escape",
                      bubbles: true,
                    });
                    document.dispatchEvent(event);
                  }
                }}
                autoFocus
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
      ref={formRef}
      onSubmit={handleSubmit(onFormSubmit)}
      className={containerClass}
      style={style}
    >
      {columns.map((column, i) => {
        if (collapsed && i >= colsNumber - 1) {
          return null;
        }
        return (
          <div 
            key={column.key} 
            className={layout === "vertical" ? "space-y-2 w-full" : "space-y-2"}
          >
            <Label
              htmlFor={column.key}
              className="text-sm font-medium flex items-center"
              style={{ width: layout === "vertical" ? "100%" : computedLabelWidth }}
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
      <div className={`${colStartClass} flex items-end justify-end`}>
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
