/**
 * 联系人创建 / 编辑 Modal（浮在客户详情 Drawer 之上）。
 *
 * 设计原则：
 *   - 不暴露「所属客户」「负责人」（由上下文确定）
 *   - 字段严格按 spec：姓名 / 手机号 / 职务 / 决策角色 / 邮箱 / 主联系人 / 备注
 *   - 沿用 TransferLeadDialog 的 controlled-open + useState submitting + try/finally 模式
 *   - 提交失败保留用户已输入的数据（Modal 不关）
 */

import type { ProFormInstance } from '@ant-design/pro-components';
import {
  ModalForm,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App } from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  type ContactCreateInput,
  type ContactRow,
  type ContactUpdateInput,
  createContactForCustomer,
  listEnumByType,
  updateContact,
} from '@/services/crm';
import { CRM_DIALOG_Z_INDEX } from '../_shared/crmDialogZIndex';

export interface ContactCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: number;
  /** 客户当前负责人；新建联系人时 ownerId 字段会默认沿用此值。 */
  ownerUserId: number | null;
  /** 已存在的联系人列表，用于决定 isPrimary 的初始值与联动。 */
  existingContacts: ContactRow[];
  editingContact: ContactRow | null;
  onSuccess?: (contact: ContactRow) => void;
}

interface FormValues {
  name?: string;
  mobile?: string;
  position?: string;
  roleCode?: string;
  email?: string;
  isPrimary?: boolean | number;
  remark?: string;
}

/**
 * 把空字符串统一归一为 undefined，避免后端落库为 "" 而不是 null。
 */
function clean(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

const MOBILE_REGEX = /^1[3-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ContactCreateModal: React.FC<ContactCreateModalProps> = ({
  open,
  onOpenChange,
  customerId,
  existingContacts,
  editingContact,
  onSuccess,
}) => {
  const { message } = App.useApp();
  const formRef = useRef<ProFormInstance | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [roleOptions, setRoleOptions] = useState<
    Array<{ label: string; value: string }>
  >([]);

  const isEdit = Boolean(editingContact);
  const editingId = editingContact?.id ?? null;

  // 打开时拉一次决策角色枚举。
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listEnumByType('crm_contact_role')
      .then((items) => {
        if (cancelled) return;
        setRoleOptions(items.map((it) => ({ label: it.name, value: it.code })));
      })
      .catch(() => {
        // 枚举拉取失败不阻塞弹窗；用户仍可只填其他字段。
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // 关闭时 resetFields，避免下次打开残留旧值。
  useEffect(() => {
    if (open) return;
    formRef.current?.resetFields();
  }, [open]);

  // initialValues 用 ModalForm 自带机制：key 强制 remount，
  // 编辑 / 新建切换 editingContact 时表单字段能正确初始化。
  const initialValues = useMemo(() => {
    if (editingContact) {
      return {
        name: editingContact.name,
        mobile: editingContact.mobile ?? undefined,
        position: editingContact.position ?? undefined,
        roleCode: editingContact.roleCode ?? undefined,
        email: editingContact.email ?? undefined,
        isPrimary: Boolean(editingContact.isPrimary),
        remark: editingContact.remark ?? undefined,
      };
    }
    return {
      name: undefined,
      mobile: undefined,
      position: undefined,
      roleCode: undefined,
      email: undefined,
      isPrimary: existingContacts.length === 0,
      remark: undefined,
    };
  }, [editingContact, existingContacts.length]);

  const modalKey = useMemo(
    () => (editingContact ? `edit-${editingContact.id}` : 'create'),
    [editingContact],
  );

  const submitText = useMemo(() => (isEdit ? '保存' : '创建'), [isEdit]);

  return (
    <ModalForm
      key={modalKey}
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? '编辑联系人' : '新建联系人'}
      width={520}
      layout="vertical"
      autoFocusFirstInput
      formRef={formRef}
      initialValues={initialValues}
      modalProps={{
        destroyOnHidden: true,
        maskClosable: false,
        zIndex: CRM_DIALOG_Z_INDEX,
      }}
      submitter={{
        searchConfig: { submitText, resetText: '取消' },
        submitButtonProps: { loading: submitting },
      }}
      onFinish={async (raw: FormValues) => {
        setSubmitting(true);
        try {
          const name = clean(raw.name);
          if (!name) {
            message.error('请填写姓名');
            return false;
          }

          const mobile = clean(raw.mobile);
          if (mobile && !MOBILE_REGEX.test(mobile)) {
            message.error('手机号格式不正确');
            return false;
          }
          const email = clean(raw.email);
          if (email && !EMAIL_REGEX.test(email)) {
            message.error('邮箱格式不正确');
            return false;
          }

          const isPrimaryValue = raw.isPrimary ? 1 : 0;
          const payload = {
            name,
            mobile: mobile ?? null,
            position: clean(raw.position) ?? null,
            roleCode: clean(raw.roleCode) ?? null,
            email: email ?? null,
            isPrimary: isPrimaryValue,
            remark: clean(raw.remark) ?? null,
          };

          let saved: ContactRow;
          if (isEdit && editingId != null) {
            const updatePayload: ContactUpdateInput = payload;
            saved = await updateContact(editingId, updatePayload);
            message.success('联系人更新成功');
          } else {
            const createPayload: Omit<ContactCreateInput, 'customerId'> =
              payload;
            saved = await createContactForCustomer(customerId, createPayload);
            message.success('联系人创建成功');
          }

          onSuccess?.(saved);
          onOpenChange(false);
          return true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : '操作失败';
          message.error(msg);
          return false;
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <ProFormText
        name="name"
        label="姓名"
        placeholder="请输入联系人姓名"
        rules={[
          { required: true, whitespace: true, message: '请填写姓名' },
          { max: 30, message: '姓名最多 30 个字符' },
        ]}
      />
      <ProFormText
        name="mobile"
        label="手机号"
        placeholder="请输入手机号"
        fieldProps={{ maxLength: 32 }}
        rules={[
          {
            validator: async (_rule, value) => {
              if (!value) return Promise.resolve();
              if (MOBILE_REGEX.test(String(value).trim()))
                return Promise.resolve();
              return Promise.reject(new Error('手机号格式不正确'));
            },
          },
        ]}
      />
      <ProFormText
        name="position"
        label="职务"
        placeholder="如：采购经理、技术负责人"
        fieldProps={{ maxLength: 100 }}
      />
      <ProFormSelect
        name="roleCode"
        label="决策角色"
        placeholder="请选择决策角色"
        options={roleOptions}
        allowClear
      />
      <ProFormText
        name="email"
        label="邮箱"
        placeholder="请输入邮箱"
        fieldProps={{ maxLength: 100 }}
        rules={[
          {
            validator: async (_rule, value) => {
              if (!value) return Promise.resolve();
              if (EMAIL_REGEX.test(String(value).trim()))
                return Promise.resolve();
              return Promise.reject(new Error('邮箱格式不正确'));
            },
          },
        ]}
      />
      <ProFormSwitch
        name="isPrimary"
        label="主联系人"
        extra="设为该客户的主要沟通联系人"
      />
      <ProFormTextArea
        name="remark"
        label="备注"
        placeholder="补充联系人偏好、沟通事项等"
        fieldProps={{ rows: 3, maxLength: 500, showCount: true }}
      />
    </ModalForm>
  );
};

export default ContactCreateModal;
