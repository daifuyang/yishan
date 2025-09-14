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

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown, ChevronUp } from "lucide-react";

import { ProColumns } from "@/types/proTable";

// 类型定义
type Breakpoint = "xs" | "sm" | "md" | "lg";

// 表单数据类型
interface FormData {
  [key: string]: string;
}

export interface QueryFilterProps {
  columns: ProColumns[];
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

function QueryFilter({
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

  const renderField = (columns: ProColumns) => {
    const { key, dataIndex, valueType = "input", title, placeholder, options } = columns;

    const name = dataIndex || key;

    console.log("name", name);

    if (!name) {
      return null;
    }

    switch (valueType) {
      case "select":
        return (
          <Select key={key} onValueChange={(value) => {
            setValue(name, value)
          }}>
            <SelectTrigger id={key} className="w-full">
              <SelectValue placeholder={placeholder || `请选择${title}`} />
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

            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">

            </PopoverContent>
          </Popover>
        );

      case "time":
        return (
          <Popover>
            <PopoverTrigger asChild>

            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">

            </PopoverContent>
          </Popover>
        );

      case "dateRange":
      case "dateTimeRange":
        return (
          <></>
        );

      case "input":
      case "email":
      case "tel":
      default:
        return (
          <Input
            id={key}
            type={valueType}
            placeholder={placeholder || `请输入${title}`}
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
              {column.title}
              {!hideRequiredMark && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </Label>
            {renderField(column)}
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
            className="flex items-center cursor-pointer text-sm"
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

export {
  QueryFilter,
}
