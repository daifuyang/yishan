import * as React from 'react';
import * as dayjs_ from 'dayjs';
import type { Dayjs } from 'dayjs';

const dayjs = dayjs_.default || dayjs_;
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface DatePickerProps {
  value?: Dayjs | null;
  defaultValue?: Dayjs;
  onChange?: (date: Dayjs | null, dateString?: string) => void;
  onSelect?: (date: Dayjs) => void;
  format?: string;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  showTime?: boolean | object;
  showToday?: boolean;
  presets?: Array<{
    label: string;
    value: Dayjs | (() => Dayjs);
  }>;
  picker?: 'date' | 'week' | 'month' | 'quarter' | 'year';
  locale?: any;
  className?: string;
  style?: React.CSSProperties;
  popupStyle?: React.CSSProperties;
  dropdownClassName?: string;
  getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement;
  disabledDate?: (current: Dayjs) => boolean;
  disabledTime?: (current: Dayjs) => any;
  renderExtraFooter?: () => React.ReactNode;
  inputReadOnly?: boolean;
  tabIndex?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  suffixIcon?: React.ReactNode;
  prefixCls?: string;
  classNames?: {
    root?: string;
    input?: string;
    popup?: string;
  };
  components?: {
    input?: React.ComponentType<any>;
    button?: React.ComponentType<any>;
  };
  previewValue?: boolean;
  changeOnBlur?: boolean;
}

const DatePicker = React.forwardRef<HTMLDivElement, DatePickerProps>(
  ({
    value,
    defaultValue,
    onChange,
    onSelect,
    format = 'YYYY-MM-DD',
    placeholder = '请选择日期',
    disabled = false,
    allowClear = true,
    showTime = false,
    showToday = true,
    presets = [],
    picker = 'date',
    className,
    style,
    disabledDate,
    disabledTime,
    renderExtraFooter,
    suffixIcon = <CalendarIcon className="h-4 w-4" />,
    classNames,
    previewValue = true,
    changeOnBlur = false,
    ...props
  }, ref) => {
    const [open, setOpen] = React.useState(false);
    const [internalValue, setInternalValue] = React.useState<Dayjs | null>(
      value !== undefined ? value : defaultValue || null
    );

    React.useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value);
      }
    }, [value]);

    const handleSelect = (date: Date | undefined) => {
      if (!date) return;
      
      const dayjsDate = dayjs(date);
      if (disabledDate && disabledDate(dayjsDate)) return;

      let finalValue = dayjsDate;
      
      if (showTime && typeof showTime === 'object') {
        const defaultTime = (showTime as any).defaultValue;
        if (defaultTime) {
          const time = dayjs(defaultTime, 'HH:mm:ss');
          finalValue = dayjsDate
            .hour(time.hour())
            .minute(time.minute())
            .second(time.second());
        }
      }

      setInternalValue(finalValue);
      onSelect?.(finalValue);
      
      if (!showTime) {
        setOpen(false);
        onChange?.(finalValue, finalValue.format(format));
      }
    };

    const handleTimeChange = (timeStr: string) => {
      if (!internalValue) return;
      
      const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
      const newValue = internalValue
        .hour(hours)
        .minute(minutes)
        .second(seconds);
      
      setInternalValue(newValue);
      onChange?.(newValue, newValue.format(format));
    };

    const handleClear = () => {
      setInternalValue(null);
      onChange?.(null, '');
    };

    const handlePresetClick = (presetValue: Dayjs | (() => Dayjs)) => {
      const actualValue = typeof presetValue === 'function' ? presetValue() : presetValue;
      setInternalValue(actualValue);
      onChange?.(actualValue, actualValue.format(format));
      setOpen(false);
    };

    const renderPresets = () => {
      if (presets.length === 0) return null;
      
      return (
        <div className="border-t p-2">
          <div className="flex flex-wrap gap-1">
            {presets.map((preset, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                onClick={() => handlePresetClick(preset.value)}
                className="h-7 px-2 text-xs"
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      );
    };

    const renderTimePicker = () => {
      if (!showTime) return null;

      const timeValue = internalValue ? internalValue.format('HH:mm:ss') : '00:00:00';
      
      return (
        <div className="border-t p-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">时间:</span>
            <input
              type="time"
              step="1"
              value={timeValue}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="flex-1 rounded border px-2 py-1 text-sm"
            />
          </div>
        </div>
      );
    };

    const displayValue = internalValue ? internalValue.format(format) : '';

    return (
      <div
        ref={ref}
        className={cn('relative', className, classNames?.root)}
        style={style}
        {...props}
      >
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !internalValue && 'text-muted-foreground',
                classNames?.input
              )}
              disabled={disabled}
            >
              {suffixIcon && <span className="mr-2">{suffixIcon}</span>}
              {displayValue || placeholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className={cn('rounded-md border bg-popover', classNames?.popup)}>
              <Calendar
                mode="single"
                selected={internalValue?.toDate()}
                onSelect={handleSelect}
                disabled={(date) => {
                  if (disabledDate) {
                    return disabledDate(dayjs(date));
                  }
                  return false;
                }}
                className="rounded-none"
              />
              {renderTimePicker()}
              {renderExtraFooter && (
                <div className="border-t p-2">
                  {renderExtraFooter()}
                </div>
              )}
              {renderPresets()}
            </div>
          </PopoverContent>
        </Popover>
        {allowClear && internalValue && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
            onClick={handleClear}
            disabled={disabled}
          >
            ×
          </Button>
        )}
      </div>
    );
  }
);

DatePicker.displayName = 'DatePicker';

// 扩展的Picker组件，支持不同的picker类型
export interface PickerProps extends Omit<DatePickerProps, 'picker'> {
  picker?: 'date' | 'week' | 'month' | 'quarter' | 'year' | 'time';
}

export const DatePickerPicker = React.forwardRef<HTMLDivElement, PickerProps>(
  ({ picker = 'date', ...props }, ref) => {
    const formatMap = {
      date: 'YYYY-MM-DD',
      week: 'YYYY-wo',
      month: 'YYYY-MM',
      quarter: 'YYYY-[Q]Q',
      year: 'YYYY',
      time: 'HH:mm:ss',
    };

    return (
      <DatePicker
        ref={ref}
        {...props}
        picker={picker as any}
        format={formatMap[picker as keyof typeof formatMap] || props.format}
      />
    );
  }
);

DatePickerPicker.displayName = 'DatePickerPicker';

// 导出类型和组件
export { DatePicker };
export { DatePickerPicker as Picker };

// 默认导出
export default DatePicker;