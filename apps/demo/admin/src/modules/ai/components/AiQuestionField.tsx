import React from 'react';
import { Checkbox, Radio, Select, TreeSelect } from 'antd';
import {
  peekNativeFieldComponent,
  peekNativeFormOperation,
  type NativeFieldComponentProps,
} from '@yishan/core-admin/form-assistance';

function ChoiceField(props: NativeFieldComponentProps) {
  const options = props.options.map((option) => ({
    value: option.value,
    label: option.description
      ? `${option.label} · ${option.description}`
      : option.label,
  }));
  return props.multiple ? (
    <Checkbox.Group
      value={props.value}
      options={options}
      disabled={props.disabled}
      onChange={props.onChange}
    />
  ) : (
    <Radio.Group
      value={props.value[0]}
      options={options}
      disabled={props.disabled}
      onChange={(event) => props.onChange([event.target.value])}
    />
  );
}
function SelectField(props: NativeFieldComponentProps) {
  return (
    <Select
      style={{ width: '100%' }}
      mode={props.multiple ? 'multiple' : undefined}
      value={props.multiple ? props.value : props.value[0]}
      options={[...props.options]}
      disabled={props.disabled}
      placeholder={props.placeholder}
      allowClear
      showSearch={{ optionFilterProp: 'label' }}
      onChange={(value: number | number[] | undefined) =>
        props.onChange(
          value === undefined ? [] : Array.isArray(value) ? value : [value],
        )
      }
    />
  );
}
function TreeSelectField(props: NativeFieldComponentProps) {
  const candidates = new Set(props.options.map((option) => option.value));
  return (
    <TreeSelect
      style={{ width: '100%' }}
      value={props.multiple ? props.value : props.value[0]}
      multiple={props.multiple}
      treeDefaultExpandAll
      showSearch={{ treeNodeFilterProp: 'title' }}
      allowClear
      disabled={props.disabled}
      placeholder={props.placeholder}
      treeDataSimpleMode
      treeData={props.options.map((option) => ({
        id: option.value,
        pId:
          option.parentValue !== undefined && candidates.has(option.parentValue)
            ? option.parentValue
            : undefined,
        value: option.value,
        title: option.label,
      }))}
      onChange={(value: number | number[] | undefined) =>
        props.onChange(
          value === undefined ? [] : Array.isArray(value) ? value : [value],
        )
      }
    />
  );
}
const builtins: Readonly<
  Record<string, React.ComponentType<NativeFieldComponentProps>>
> = {
  select: SelectField,
  treeSelect: TreeSelectField,
  checkbox: ChoiceField,
  radio: ChoiceField,
};
export function AiQuestionField({
  operationId,
  field,
  ...props
}: NativeFieldComponentProps & { operationId?: string; field: string }) {
  const definition = operationId
    ? peekNativeFormOperation(operationId)?.fieldComponents?.[field]
    : undefined;
  const Component = definition
    ? (peekNativeFieldComponent(definition.component) ??
      builtins[definition.component] ??
      ChoiceField)
    : ChoiceField;
  return <Component {...props} placeholder={definition?.placeholder} />;
}
