import Picker, { PickerPanel } from "rc-picker";
import 'dayjs/locale/zh-cn';
import dayjsGenerateConfig from "rc-picker/es/generate/dayjs";
import zhCN from "rc-picker/es/locale/zh_CN";
import { Input } from "./input";

console.log("zhCN", zhCN);

function DatePicker() {
  return (
    <>
      <Picker
        prefixCls="shadcn-date-picker"
        generateConfig={dayjsGenerateConfig}
        locale={zhCN}
        components={{
          input: (props) => <Input {...props} />,
        }}
        allowClear
      />
      <PickerPanel
        prefixCls="shadcn-date-picker"
        generateConfig={dayjsGenerateConfig}
        locale={zhCN}
      />
    </>
  );
}

export { DatePicker };
