import Picker from "rc-picker";
import dayjsGenerateConfig from "rc-picker/es/generate/dayjs";
import zhCN from "rc-picker/es/locale/zh_CN";

function DatePicker() {
  return (
    <Picker
      prefixCls="shadcn-date-picker"
      generateConfig={dayjsGenerateConfig}
      locale={zhCN}
      allowClear
    />
  );
}

export { DatePicker };
