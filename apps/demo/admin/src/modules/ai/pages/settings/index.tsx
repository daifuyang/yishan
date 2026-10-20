import {
  PageContainer,
  ProForm,
  ProFormText,
} from '@ant-design/pro-components';
import { Alert, Button, Form, Space, Typography } from 'antd';
import { useEffect, useState } from 'react';
import {
  aiSettingsGet,
  aiSettingsSave,
  aiSettingsTest,
} from '@/services/generated/ai';
import { usePermission } from '@/utils/permission';

type SettingsValues = Parameters<typeof aiSettingsSave>[0];
type PublicSettings = Awaited<ReturnType<typeof aiSettingsGet>>['data'];

const sourceLabels = {
  database: '数据库配置',
  environment: '环境变量回退',
  unconfigured: '尚未配置',
};

export default function AiSettings() {
  const can = usePermission();
  const canRead = can('ai:settings:read');
  const canUpdate = can('ai:settings:update');
  const [form] = Form.useForm<SettingsValues>();
  const [settings, setSettings] = useState<PublicSettings>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  }>();

  useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    let active = true;
    void aiSettingsGet()
      .then((response) => {
        if (!active) return;
        if (!response.data) throw new Error('Missing settings');
        setSettings(response.data);
        form.setFieldsValue({
          baseUrl: response.data.baseUrl,
          model: response.data.model,
          apiKey: '',
        });
      })
      .catch(() => {
        if (active)
          setNotice({ type: 'error', text: '加载设置失败，请刷新页面重试' });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canRead, form]);

  if (!canRead)
    return (
      <PageContainer>
        <Alert type="warning" title="无权查看 AI 设置" />
      </PageContainer>
    );

  return (
    <PageContainer title="AI 模型设置" loading={loading}>
      <div style={{ maxWidth: 640 }}>
        <Typography.Paragraph>
          配置一个 Anthropic
          兼容模型。保存后优先使用数据库配置；没有数据库记录时使用环境变量回退。
        </Typography.Paragraph>
        {settings && (
          <Typography.Paragraph>
            当前来源：{sourceLabels[settings.source]}；API Key：
            {settings.hasApiKey ? '已配置' : '未配置'}
          </Typography.Paragraph>
        )}
        {notice && (
          <Alert
            type={notice.type}
            title={notice.text}
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}
        <ProForm<SettingsValues>
          form={form}
          layout="vertical"
          disabled={!settings || !canUpdate || saving || testing}
          submitter={false}
          onValuesChange={() => {
            setDirty(true);
            setNotice(undefined);
          }}
          onFinish={async (values) => {
            if (!settings || !canUpdate) return false;
            setSaving(true);
            setNotice(undefined);
            try {
              const response = await aiSettingsSave({
                baseUrl: values.baseUrl?.trim(),
                model: values.model.trim(),
                ...(values.apiKey?.trim()
                  ? { apiKey: values.apiKey.trim() }
                  : {}),
              });
              if (!response.data) throw new Error('Missing settings');
              setSettings(response.data);
              form.setFieldsValue({
                baseUrl: response.data.baseUrl,
                model: response.data.model,
                apiKey: '',
              });
              setDirty(false);
              setNotice({ type: 'success', text: '设置已保存' });
              return true;
            } catch {
              setNotice({ type: 'error', text: '保存失败，请重试' });
              return false;
            } finally {
              setSaving(false);
            }
          }}
        >
          <ProFormText
            name="baseUrl"
            label="Base URL"
            placeholder="https://api.anthropic.com/v1"
            rules={[
              { required: true, whitespace: true, message: '请输入 Base URL' },
              { type: 'url', message: '请输入有效的 HTTP 或 HTTPS 地址' },
            ]}
          />
          <ProFormText
            name="model"
            label="模型名称"
            rules={[
              { required: true, whitespace: true, message: '请输入模型名称' },
            ]}
          />
          <ProFormText.Password
            name="apiKey"
            label="API Key"
            rules={[
              {
                required:
                  settings?.source !== 'database' || !settings.hasApiKey,
                whitespace: true,
                message: '首次保存请输入 API Key',
              },
            ]}
            extra="首次保存时请输入密钥；后续编辑留空保留已有密钥。环境密钥不会自动复制，保存后不会回显。"
            fieldProps={{
              autoComplete: 'new-password',
              visibilityToggle: false,
            }}
          />
          {canUpdate && (
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={saving}
                disabled={!settings || loading || testing}
              >
                保存设置
              </Button>
              <Button
                loading={testing}
                disabled={!settings || loading || saving || dirty}
                onClick={async () => {
                  if (!settings || dirty) return;
                  setTesting(true);
                  setNotice(undefined);
                  try {
                    const response = await aiSettingsTest();
                    if (!response.data) throw new Error('Missing result');
                    setNotice({
                      type: response.data.ok ? 'success' : 'error',
                      text: response.data.message,
                    });
                  } catch {
                    setNotice({
                      type: 'error',
                      text: '连接测试失败，请检查已保存配置',
                    });
                  } finally {
                    setTesting(false);
                  }
                }}
              >
                测试已保存配置
              </Button>
            </Space>
          )}
        </ProForm>
        {canUpdate && (
          <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
            连接测试使用已保存配置。修改后请先保存设置。
          </Typography.Paragraph>
        )}
      </div>
    </PageContainer>
  );
}
