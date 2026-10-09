import { LockOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { App, Button, Card, Form, Input } from 'antd';
import React, { useState } from 'react';
import { appChangeMyPassword } from '@/services/generated/appUsers';
import { logout } from '@/utils/auth';
import { PASSWORD_PATTERN } from '../constants';

interface SecurityPanelProps {
  intl: ReturnType<typeof useIntl>;
}

export const SecurityPanel: React.FC<SecurityPanelProps> = ({ intl }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm<{
    oldPassword: string;
    newPassword: string;
    confirm: string;
  }>();
  const [submitting, setSubmitting] = useState(false);
  const t = (id: string, defaultMessage?: string) =>
    intl.formatMessage({ id, defaultMessage });
  return (
    <Card title={t('account.center.security.title', '安全设置')}>
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 480 }}
        onFinish={async (values) => {
          setSubmitting(true);
          try {
            const res: any = await appChangeMyPassword({
              oldPassword: values.oldPassword,
              newPassword: values.newPassword,
            });
            if (res?.success) {
              message.success(t('account.center.security.success', '密码已修改，请重新登录'));
              form.resetFields();
              await logout(true);
              return;
            }
            message.error(res?.message ?? t('account.center.security.error', '密码修改失败'));
          } catch (e: any) {
            message.error(e?.message ?? t('account.center.security.error', '密码修改失败'));
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item name="oldPassword" label={t('account.center.security.oldPassword')}
          rules={[{ required: true, message: '请输入当前密码' }]}>
          <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
        </Form.Item>
        <Form.Item name="newPassword" label={t('account.center.security.newPassword')}
          rules={[
            { required: true, message: '请输入新密码' },
            { pattern: PASSWORD_PATTERN, message: '密码至少 6 位，且必须包含字母和数字' },
          ]}>
          <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
        </Form.Item>
        <Form.Item name="confirm" label={t('account.center.security.confirm')}
          dependencies={['newPassword']}
          rules={[
            { required: true, message: '请再次输入新密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                return Promise.reject(new Error('两次输入的密码不一致'));
              },
            }),
          ]}>
          <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>
            {t('account.center.security.submit')}
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};
