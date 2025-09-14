import Picker, { RangePicker } from "rc-picker";
import 'dayjs/locale/zh-cn';
import dayjsGenerateConfig from "rc-picker/es/generate/dayjs";
import zhCN from "rc-picker/es/locale/zh_CN";
import { CalendarIcon, X, MoveRight } from "lucide-react";
import { ReactNode } from "react";
import { Button } from "./button";

interface DatePickerProps {
  allowClear?: boolean | { clearIcon?: ReactNode };
  suffixIcon?: ReactNode;
  open?: boolean;
  picker?: 'time' | 'date' | 'week' | 'month' | 'year' | 'quarter';
  [key: string]: any; // 允许传入其他 rc-picker 支持的 props
}

function DatePicker({
  allowClear = {
    clearIcon: <span className="w-4 h-4 bg-[rgba(0,0,0,0.25)] rounded-full flex items-center justify-center cursor-pointer transition-colors">
      <X color="white" className="w-2 h-2" />
    </span>,
  },
  suffixIcon = <CalendarIcon className="w-4 h-4" />,
  open = undefined,
  picker = "date",
  ...otherProps
}: DatePickerProps) {
  return (
    <>
      <Picker
        prefixCls="shadcn-date-picker"
        generateConfig={dayjsGenerateConfig}
        locale={zhCN}
        allowClear={allowClear}
        suffixIcon={suffixIcon}
        open={open}
        picker={picker}
        components={{
          button: ({ children, ...props }) => (
            <Button size="sm" className="h-7 px-2 py-1.5 text-xs" {...props}>{children}</Button>
          ),
        }}
        {...otherProps}
      />
    </>
  );
}

interface RangePickerProps {
  allowClear?: boolean | { clearIcon?: ReactNode };
  suffixIcon?: ReactNode;
  open?: boolean;
  picker?: 'time' | 'date' | 'week' | 'month' | 'year' | 'quarter';
  separator?: ReactNode;
  placeholder?: [string, string];
  showTime?: boolean | object;
  [key: string]: any; // 允许传入其他 rc-picker 支持的 props
}



DatePicker.RangePicker = ({
  allowClear = {
    clearIcon: <span className="w-4 h-4 bg-[rgba(0,0,0,0.25)] rounded-full flex items-center justify-center cursor-pointer transition-colors">
      <X color="white" className="w-2 h-2" />
    </span>,
  },
  suffixIcon = <CalendarIcon className="w-4 h-4" />,
  open = undefined,
  picker = "date",
  separator = <MoveRight className="w-4 h-4" />,
  placeholder = ["开始日期", "结束日期"],
  showTime = false,
  ...otherProps
}: RangePickerProps) => {
  return (
    <RangePicker
      prefixCls="shadcn-date-picker"
      generateConfig={dayjsGenerateConfig}
      locale={zhCN}
      allowClear={allowClear}
      suffixIcon={suffixIcon}
      open={open}
      picker={picker}
      separator={separator}
      placeholder={placeholder}
      showTime={showTime}
      components={{
        button: ({ children, ...props }) => (
          <Button size="sm" className="h-7 px-2 py-1.5 text-xs" {...props}>{children}</Button>
        ),
      }}
      {...otherProps}
    />
  )
};

export { DatePicker };
