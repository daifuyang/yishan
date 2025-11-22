# 表单组件开发规范

本文档提供了在 Yishan Admin 系统中开发表单组件的标准规范和最佳实践，适用于所有 CRUD 模块的表单组件开发。

## 设计原则

### 1. 模式判断规范

**核心原则：通过 `id` 存在性判断编辑模式，不使用 `mode` 参数**

```tsx
// ✅ 正确做法 - 通过 id 存在性判断
export interface FormComponentProps {
  title: string;
  trigger: React.ReactNode;
  initialValues?: Partial<API.EntityType>;
  onFinish: (values: API.CreateReq | API.UpdateReq) => Promise<void>;
}

const FormComponent: React.FC<FormComponentProps> = ({
  initialValues = { status: "1" }, // 设置默认值
  // ... 其他属性
}) => {
  // 判断是否为编辑模式
  const isEdit = !!initialValues?.id;
  
  // 编辑时重新获取数据
  const fetchDetail = async (id: number) => {
    const res = await getDetail({ id });
    if (res.success && res.data) {
      formRef.current?.setFieldsValue(res.data);
    }
  };
  
  return (
    <ModalForm
      // ModalForm 配置
      onOpenChange={(open) => {
        if (open && initialValues?.id) {
          fetchDetail(initialValues.id);
        }
      }}
    >
      {/* 表单字段 */}
    </ModalForm>
  );
};

// ❌ 错误做法 - 使用 mode 参数
export interface FormComponentProps {
  mode: "create" | "edit"; // 不需要 mode 参数
  initialValues?: Partial<API.EntityType>;
  // ...
}
```

**使用方式：**
- **创建模式**：不传入 `id` 或 `id: undefined`
- **编辑模式**：传入包含 `id` 的 `initialValues`

### 2. 组件属性标准化

所有表单组件应遵循统一的属性接口（回调仅用于成功后刷新列表）：

```tsx
export interface FormComponentProps {
  title: string;
  trigger: React.ReactNode;
  initialValues?: Partial<T>;
  onFinish?: () => Promise<void>;
  onInit?: () => Promise<T | undefined>;
}
```

### 3. 默认值设置规范

```tsx
const FormComponent: React.FC<FormComponentProps> = ({
  initialValues = { status: "1", sortOrder: 0 }, // 根据业务需要设置默认值
  // ... 其他属性
}) => {
  // 组件逻辑
};
```

## 数据获取模式

### 标准模式：ModalForm 打开时获取

**必须严格执行的模式** - 在 ModalForm 打开时获取编辑数据：

```tsx
const FormComponent: React.FC<FormComponentProps> = ({
  initialValues,
  // ...
}) => {
  const fetchDetail = async (id: number) => {
    const res = await getDetail({ id });
    if (res.success && res.data) {
      formRef.current?.setFieldsValue(res.data);
    }
  };
  
  return (
    <ModalForm
      // ... 其他配置
      onOpenChange={(open) => {
        if (open && initialValues?.id) {
          fetchDetail(initialValues.id);
        }
      }}
    >
      {/* 表单字段 */}
    </ModalForm>
  );
};
```

### 为什么必须使用此模式？

1. **性能优化**：只在需要时才获取数据，避免不必要的网络请求
2. **用户体验**：Modal 打开时显示加载状态，用户感知更好
3. **数据一致性**：确保每次打开 Modal 都能获取最新数据
4. **错误处理**：可以在 Modal 打开时统一处理获取失败的情况
5. **生命周期管理**：与 Modal 的生命周期完美契合
6. **无需手动重置**：ModalForm 的 `destroyOnClose: true` 会自动处理表单重置

## 表单字段处理规范

### 1. 密码字段处理

```tsx
<ProFormText.Password
  name="password"
  label="密码"
  placeholder={!initialValues?.id ? "请输入密码" : "不输入则保持原密码"}
  rules={[
    { required: !initialValues?.id, message: "请输入密码" },
    { min: 6, message: "至少6位" },
  ]}
  colProps={{ span: 12 }}
  fieldProps={{
    autoComplete: 'new-password'
  }}
/>
```

### 2. 状态字段处理

```tsx
<ProFormRadio.Group
  name="status"
  label="状态"
  options={statusDict}
  colProps={{ span: 12 }}
/>
```

### 3. 字典数据使用

```tsx
const FormComponent: React.FC<FormComponentProps> = ({
  // ...
}) => {
  const { initialState } = useModel('@@initialState');
  const dictDataMap = initialState?.dictDataMap || {};
  
  // 获取相关字典数据
  const statusDict = dictDataMap.default_status || [];
  const genderDict = dictDataMap.user_gender || [];
  
  return (
    <ModalForm>
      <ProFormRadio.Group
        name="status"
        label="状态"
        options={statusDict}
      />
    </ModalForm>
  );
};
```

## 数据提交处理

### 1. 基础提交逻辑（仅成功时关闭）

```tsx
const handleFinish = async (values: any) => {
  const basePayload = {
    name: values.name,
    code: values.code,
    status: values.status,
    sortOrder: values.sortOrder,
    remark: values.remark,
  };

  if (!initialValues?.id) {
    const payload = { ...basePayload, password: values.password };
    const res = await createEntity(payload);
    if (res.success) {
      await onFinish?.();
      return true;
    }
    return false;
  }

  const payload = { ...basePayload };
  if (values.password?.trim()) {
    payload.password = values.password;
  }
  const res = await updateEntity({ id: String(initialValues.id) }, payload);
  if (res.success) {
    await onFinish?.();
    return true;
  }
  return false;
};
```

### 2. 日期字段处理

```tsx
<ProFormDatePicker
  name="birthDate"
  label="出生日期"
  placeholder="请选择出生日期"
  fieldProps={{ style: { width: "100%" } }}
  colProps={{ span: 12 }}
  transform={(value: Dayjs | null) => ({ 
    birthDate: value ? value.format("YYYY-MM-DD") : undefined 
  })}
/>
```

## 完整模板示例

### 通用表单组件模板

```tsx
import React, { useRef } from "react";
import {
  ModalForm,
  ProFormText,
  ProFormRadio,
  ProFormTextArea,
  ProFormInstance,
} from "@ant-design/pro-components";
import { useModel } from "@umijs/max";
import { getDetail, createEntity, updateEntity } from "@/services/yishan-admin/entityService";

export interface EntityFormProps {
  title: string;
  trigger: React.ReactNode;
  initialValues?: Partial<API.EntityType>;
  onFinish?: () => Promise<void>;
}

const EntityForm: React.FC<EntityFormProps> = ({
  title,
  trigger,
  initialValues = { status: "1" },
  onFinish,
}) => {
  const formRef = useRef<ProFormInstance>(null);
  const { initialState } = useModel('@@initialState');
  const dictDataMap = initialState?.dictDataMap || {};
  const statusDict = dictDataMap.default_status || [];

  const fetchDetail = async (id: number) => {
    const res = await getDetail({ id });
    if (res.success && res.data) {
      formRef.current?.setFieldsValue(res.data);
    }
  };

  const handleFinish = async (values: any) => {
    const payload = {
      name: values.name,
      code: values.code,
      status: values.status,
      remark: values.remark,
    };
    if (!initialValues?.id) {
      const res = await createEntity(payload);
      if (res.success) {
        await onFinish?.();
        return true;
      }
      return false;
    }
    const res = await updateEntity({ id: String(initialValues.id) }, payload);
    if (res.success) {
      await onFinish?.();
      return true;
    }
    return false;
  };

  return (
    <ModalForm
      title={title}
      trigger={trigger}
      autoFocusFirstInput
      modalProps={{ destroyOnClose: true, maskClosable: false }}
      grid
      formRef={formRef}
      initialValues={initialValues}
      onFinish={handleFinish}
      onOpenChange={(open) => {
        if (open && initialValues?.id) {
          fetchDetail(initialValues.id);
        }
      }}
    >
      <ProFormText name="name" label="名称" placeholder="请输入名称" rules={[{ required: true, message: "请输入名称" }]} colProps={{ span: 12 }} />
      <ProFormText name="code" label="编码" placeholder="请输入编码" rules={[{ required: true, message: "请输入编码" }]} colProps={{ span: 12 }} />
      <ProFormRadio.Group name="status" label="状态" options={statusDict} colProps={{ span: 12 }} />
      <ProFormTextArea name="remark" label="备注" placeholder="请输入备注" colProps={{ span: 24 }} />
    </ModalForm>
  );
};

export default EntityForm;
```

## 使用示例

### 在列表页面中使用

```tsx
import EntityForm from './components/EntityForm';

const EntityList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const refresh = async () => { actionRef.current?.reload(); };
  return (
    <>
      <ProTable actionRef={actionRef} /* ...其他配置 */
        toolBarRender={() => [
          <EntityForm
            key="create"
            title="新建实体"
            trigger={<Button type="primary"><PlusOutlined /> 新建</Button>}
            onFinish={refresh}
          />
        ]}
      />

      {/* 在操作列中 */}
      {/* <EntityForm title="编辑实体" trigger={<a>编辑</a>} initialValues={record} onFinish={refresh} /> */}
    </>
  );
};
```

## 设计模式对比

### 新旧模式对比

| 方面 | 旧模式 | 新模式 |
|------|--------|--------|
| 模式判断 | 使用 `mode` 参数 | 通过 `id` 存在性判断 |
| 参数数量 | 较多（需要mode） | 简洁（无需mode） |
| 数据获取 | 使用复杂的 `request` 方法 | 使用 `initialValues` + `onOpenChange` |
| 代码可读性 | 一般 | 更好 |
| 维护性 | 一般 | 更好 |
| 类型安全 | 容易出错 | 更安全 |

### 优势说明

1. **更简洁的接口**：移除了不必要的 `mode` 参数
2. **更直观的判断**：通过 `id` 存在性判断比 `mode` 参数更直观
3. **更好的数据流**：使用 `initialValues` 符合 React 的数据流理念
4. **更容易测试**：不需要模拟 `mode` 参数
5. **更好的类型安全**：减少了人为错误的可能性
6. **更好的性能**：只在需要时获取数据
7. **一致的关闭行为**：仅在服务端成功时返回 `true` 关闭表单
8. **更好的用户体验**：Modal 打开时才加载编辑数据

## 最佳实践总结

### 1. 组件设计
- ✅ 使用 `initialValues.id` 判断编辑模式
- ✅ 设置合理的默认值
- ✅ 使用统一的属性接口
- ❌ 不要使用 `mode` 参数
- ❌ 不要在组件内部硬编码状态值

### 2. 数据获取
- ✅ **必须**在 ModalForm 的 `onOpenChange` 中获取编辑数据
- ✅ 使用 `formRef.setFieldsValue` 设置表单值
- ✅ 处理获取数据的错误情况
- ✅ 使用 `destroyOnClose: true` 自动处理表单重置
- ❌ **严禁**使用 useEffect 监听获取数据（避免不必要的网络请求）

### 3. 表单字段
- ✅ 根据编辑模式调整字段验证规则
- ✅ 使用字典数据保持一致性
- ✅ 合理设置字段布局和响应式
- ❌ 不要硬编码状态选项

### 4. 数据提交
- ✅ 根据模式处理特殊字段（如密码）
- ✅ 保持提交数据格式的一致性
- ✅ 正确处理返回结果
- ❌ 不要混合创建和编辑的逻辑

## 相关参考

- [模块开发规范指南](./MODULE_DEVELOPMENT_GUIDE.md)
- [字典数据规范](./DICTIONARY_SPECIFICATION.md)
- [列表页面规范](./LIST_SPECIFICATION.md)
