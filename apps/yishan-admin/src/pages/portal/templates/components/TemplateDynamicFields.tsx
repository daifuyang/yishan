import React from "react";
import dayjs from "dayjs";
import {
  ProFormText,
  ProFormTextArea,
  ProFormRadio,
  ProFormSelect,
  ProFormSwitch,
  ProFormDateTimePicker,
} from "@ant-design/pro-components";

export interface TemplateDynamicFieldsProps {
  fields?: any[];
  title?: string; // 小标题，默认“扩展”
}

const TemplateDynamicFields: React.FC<TemplateDynamicFieldsProps> = ({
  fields = [],
}) => {
  if (!Array.isArray(fields) || fields.length === 0) return null;

  return (
    <>
      {fields.map((f: any, idx: number) => {
        const name: string = (f?.name || "").trim();
        const label: string = f?.label || name || `字段${idx + 1}`;
        const type: string = (f?.type || "input").toLowerCase();
        const required: boolean = !!f?.required;
        const options: any[] = Array.isArray(f?.options) ? f.options : [];
        const props: any = f?.props || {};
        const span =
          typeof props?.span === "number"
            ? props.span
            : type === "textarea"
              ? 24
              : 12;
        const common = {
          name,
          label,
          colProps: { span },
          rules: required
            ? [{ required: true, message: `请输入${label}` }]
            : undefined,
        } as any;

        switch (type) {
          case "textarea":
            return (
              <ProFormTextArea
                key={name || idx}
                {...common}
                placeholder={props?.placeholder}
                fieldProps={{ autoSize: { minRows: 4 } }}
              />
            );
          case "radio":
            return (
              <ProFormRadio.Group
                key={name || idx}
                {...common}
                options={options?.map((o: any) => ({
                  label: o.label,
                  value: o.value,
                }))}
              />
            );
          case "checkbox":
            return (
              <ProFormSelect
                key={name || idx}
                {...common}
                fieldProps={{ mode: "multiple" }}
                options={options?.map((o: any) => ({
                  label: o.label,
                  value: o.value,
                }))}
              />
            );
          case "select":
            return (
              <ProFormSelect
                key={name || idx}
                {...common}
                options={options?.map((o: any) => ({
                  label: o.label,
                  value: o.value,
                }))}
              />
            );
          case "number":
            return (
              <ProFormText
                key={name || idx}
                {...common}
                placeholder={props?.placeholder}
                fieldProps={{ type: "number" }}
              />
            );
          case "switch":
            return <ProFormSwitch key={name || idx} {...common} />;
          case "date":
            return (
              <ProFormDateTimePicker
                key={name || idx}
                {...common}
                transform={(v: any) => {
                  if (!v) return { [name]: undefined } as any;
                  const d = dayjs(v);
                  return {
                    [name]: d.isValid()
                      ? d.format("YYYY-MM-DD 00:00:00")
                      : undefined,
                  } as any;
                }}
              />
            );
          case "datetime":
            return (
              <ProFormDateTimePicker
                key={name || idx}
                {...common}
                transform={(v: any) => {
                  if (!v) return { [name]: undefined } as any;
                  const d = dayjs(v);
                  return {
                    [name]: d.isValid()
                      ? d.format("YYYY-MM-DD HH:mm:ss")
                      : undefined,
                  } as any;
                }}
              />
            );
          default:
            return (
              <ProFormText
                key={name || idx}
                {...common}
                placeholder={props?.placeholder}
              />
            );
        }
      })}
    </>
  );
};

export default TemplateDynamicFields;
