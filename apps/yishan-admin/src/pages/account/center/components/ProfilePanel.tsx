import { CheckOutlined } from '@ant-design/icons';
import { useIntl, useModel } from '@umijs/max';
import { App, Avatar, Button, Card, DatePicker, Form, Input, Modal, Row, Select, Space, Spin } from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authGetCurrentUser } from '@/services/generated/auth';
import { appUpdateMe } from '@/services/generated/appUsers';
import { ImageCropperModal } from '@/components';
import { AttachmentImageSelect } from '@/components/AttachmentSelect';
import dayjs from 'dayjs';
import { DATE_FMT, GENDER_OPTIONS, PHONE_PATTERN } from '../constants';

interface ProfilePanelProps {
  intl: ReturnType<typeof useIntl>;
  user: any;
  onSaved: (u: any) => void;
}

export const ProfilePanel: React.FC<ProfilePanelProps> = ({ intl, user, onSaved }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm<any>();
  const [submitting, setSubmitting] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const cropResolveRef = useRef<((file: File | null) => void) | null>(null);
  const t = (id: string, defaultMessage?: string) =>
    intl.formatMessage({ id, defaultMessage });

  const avatarBeforeUpload = useCallback((file: File): Promise<File | null> => {
    if (!file.type.startsWith('image/')) {
      // 非图片不弹裁切，沿用原文件
      return Promise.resolve(file);
    }
    return new Promise<File | null>((resolve) => {
      cropResolveRef.current = resolve;
      setCropFile(file);
      setCropOpen(true);
    });
  }, []);

  const handleCropConfirm = useCallback((cropped: File) => {
    cropResolveRef.current?.(cropped);
    cropResolveRef.current = null;
    setCropOpen(false);
    setCropFile(null);
  }, []);

  const handleCropCancel = useCallback(() => {
    cropResolveRef.current?.(null);
    cropResolveRef.current = null;
    setCropOpen(false);
    setCropFile(null);
  }, []);

  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        avatar: user.avatar,
        nickname: user.nickname,
        realName: user.realName,
        email: user.email,
        gender: user.gender,
        birthDate: user.birthDate ? dayjs(user.birthDate) : undefined,
        phone: user.phone,
      });
    }
  }, [user, form]);
  return (
    <Card title={t('account.center.title', '个人中心')}>
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 560 }}
        onFinish={async (values) => {
          setSubmitting(true);
          try {
            const res: any = await appUpdateMe({
              nickname: values.nickname,
              realName: values.realName,
              email: values.email,
              gender: values.gender,
              birthDate: values.birthDate
                ? values.birthDate.format('YYYY-MM-DD')
                : undefined,
              phone: values.phone,
              avatar: values.avatar,
            });
            if (res?.success && res.data) {
              onSaved(res.data);
              message.success(t('account.center.success', '保存成功'));
            } else {
              message.error(
                res?.message ?? t('account.center.error', '保存失败'),
              );
            }
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item name="avatar" label={t('account.center.avatar', '头像')}>
          <AttachmentImageSelect beforeUpload={avatarBeforeUpload} />
        </Form.Item>
        <Form.Item name="nickname" label={t('account.center.nickname', '昵称')}>
          <Input maxLength={50} allowClear />
        </Form.Item>
        <Form.Item name="realName" label={t('account.center.realName', '姓名')}>
          <Input maxLength={50} allowClear />
        </Form.Item>
        <Form.Item
          name="email"
          label={t('account.center.email', '邮箱')}
          rules={[{ type: 'email' }]}
        >
          <Input maxLength={100} allowClear />
        </Form.Item>
        <Form.Item
          name="phone"
          label={t('account.center.phone', '手机号')}
          rules={[
            { pattern: PHONE_PATTERN, message: '请输入合法的中国大陆手机号' },
          ]}
        >
          <Input maxLength={11} allowClear placeholder="请输入 11 位手机号" />
        </Form.Item>
        <Form.Item name="gender" label={t('account.center.gender', '性别')}>
          <Select
            allowClear
            placeholder={t('account.center.gender', '性别')}
            options={GENDER_OPTIONS}
          />
        </Form.Item>
        <Form.Item
          name="birthDate"
          label={t('account.center.birthDate', '出生日期')}
        >
          <DatePicker
            format="YYYY-MM-DD"
            style={{ width: '100%' }}
            placeholder="YYYY-MM-DD"
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>
            {t('account.center.submit', '保存')}
          </Button>
        </Form.Item>
      </Form>
      <ImageCropperModal
        open={cropOpen}
        file={cropFile}
        aspect={1}
        shape="round"
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
        onFileChange={setCropFile}
        title="修改头像"
      />
    </Card>
  );
};
