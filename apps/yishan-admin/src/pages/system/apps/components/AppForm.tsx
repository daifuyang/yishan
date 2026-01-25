import React, { useRef, useState } from 'react';
import { ModalForm, ProFormText, ProFormRadio, ProFormDigit, ProFormTextArea, ProFormItem } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { getAppDetail, createApp, updateApp } from '@/services/yishan-admin/sysApps';
import { PRESET_COLORS, ICON_KEYS, ICON_MAP } from '../constants';
import { CheckOutlined, EditOutlined } from '@ant-design/icons';
import { Avatar, Popover, theme } from 'antd';

export interface AppFormProps {
  title: string;
  trigger?: JSX.Element;
  initialValues?: Partial<API.sysApp>;
  onFinish?: () => Promise<void>;
}

const StylePickerContent = ({ 
  icon, 
  iconColor, 
  onIconChange, 
  onColorChange 
}: { 
  icon?: string; 
  iconColor?: string; 
  onIconChange: (v: string) => void;
  onColorChange: (v: string) => void;
}) => {
  const { token } = theme.useToken();

  return (
    <div style={{ width: 336 }}> {/* 6 items * 48px + gaps approx */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(6, 1fr)', 
        gap: 8,
        marginBottom: 16
      }}>
        {ICON_KEYS.map((iconKey) => (
          <div
            key={iconKey}
            onClick={() => onIconChange(iconKey)}
            style={{
              width: 48,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backgroundColor: icon === iconKey ? token.colorPrimaryBg : '#f5f5f5',
              borderRadius: 4,
              fontSize: 24,
              color: icon === iconKey ? token.colorPrimary : '#666',
              transition: 'all 0.2s',
            }}
            title={iconKey}
          >
            {ICON_MAP[iconKey]}
          </div>
        ))}
      </div>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(8, 1fr)', 
        gap: 8, 
        paddingTop: 16, 
        borderTop: '1px solid #f0f0f0' 
      }}>
        {PRESET_COLORS.map((color) => (
          <div 
            key={color} 
            style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              height: 48 
            }}
          >
            <div
              onClick={() => onColorChange(color)}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor: color,
                cursor: 'pointer',
                border: iconColor === color ? '2px solid rgba(0,0,0,0.85)' : '1px solid transparent',
                boxShadow: iconColor === color ? '0 0 0 2px #fff' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                transform: iconColor === color ? 'scale(1.2)' : 'scale(1)',
              }}
            >
              {iconColor === color && <CheckOutlined style={{ color: '#fff', fontSize: 12 }} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AppForm: React.FC<AppFormProps> = ({
  title,
  trigger,
  initialValues = { status: '1', sort_order: 0, iconColor: '#1677FF' },
  onFinish,
}) => {
  const formRef = useRef<any>(undefined);
  const [icon, setIcon] = useState<string | undefined>(initialValues?.icon);
  const [iconColor, setIconColor] = useState<string>(initialValues?.iconColor || '#1677FF');
  const [appName, setAppName] = useState<string>(initialValues?.name || '');

  const { initialState } = useModel('@@initialState');
  const dictDataMap = initialState?.dictDataMap || {};
  const defaultStatusDict: Array<{ label: string; value: string }> = dictDataMap.default_status || [];

  const fetchDetail = async (id: number) => {
    const res = await getAppDetail({ id });
    if (res.success && res.data) {
      formRef.current?.setFieldsValue(res.data);
      setIcon(res.data.icon);
      setIconColor(res.data.iconColor || '#1677FF');
      setAppName(res.data.name || '');
    }
  };

  if (!trigger) return null;

  return (
    <ModalForm
      width={520}
      title={title}
      trigger={trigger}
      autoFocusFirstInput
      formRef={formRef}
      initialValues={initialValues}
      modalProps={{ destroyOnClose: true, maskClosable: false }}
      onOpenChange={(open) => {
        if (open) {
          if (initialValues?.id) {
            fetchDetail(Number(initialValues.id));
          } else {
             // Reset for new form
             setIcon(undefined);
             setIconColor('#1677FF');
             setAppName('');
             formRef.current?.resetFields();
             formRef.current?.setFieldsValue({ status: '1', sort_order: 0, iconColor: '#1677FF' });
          }
        }
      }}
      onFinish={async (values) => {
        const basePayload: API.saveAppReq = {
          name: values.name,
          icon: icon, // Use state
          iconColor: iconColor, // Use state
          status: values.status,
          sort_order: Number(values.sort_order ?? 0),
          description: values.description,
        };
        if (!initialValues?.id) {
          const res = await createApp(basePayload);
          if (res.success) {
            await onFinish?.();
            return true;
          }
          return false;
        }
        const res = await updateApp({ id: initialValues.id }, basePayload as API.updateAppReq);
        if (res.success) {
          await onFinish?.();
          return true;
        }
        return false;
      }}
      onValuesChange={(changedValues) => {
        if (changedValues.name !== undefined) {
          setAppName(changedValues.name);
        }
      }}
    >
      <ProFormText
        name="name"
        label="应用名称"
        placeholder="请输入应用名称"
        rules={[{ required: true, message: '请输入应用名称' }, { max: 50, message: '最多50个字符' }]}
      />

      <ProFormItem label="应用图标" required>
        <Popover
          content={
            <StylePickerContent 
              icon={icon} 
              iconColor={iconColor} 
              onIconChange={setIcon} 
              onColorChange={setIconColor} 
            />
          }
          trigger="click"
          placement="bottomLeft"
          arrow={false}
          overlayInnerStyle={{ padding: 16 }}
        >
          <div style={{ display: 'inline-block', position: 'relative', cursor: 'pointer' }}>
             <Avatar 
               shape="square" 
               size={64} 
               style={{ 
                 backgroundColor: iconColor,
                 fontSize: 28,
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
               }}
               icon={icon && ICON_MAP[icon] ? ICON_MAP[icon] : null}
             >
               {(!icon || !ICON_MAP[icon]) && (appName ? appName.substring(0, 1) : 'A')}
             </Avatar>
             <div style={{
                position: 'absolute',
                bottom: -6,
                right: -6,
                backgroundColor: '#fff',
                borderRadius: '50%',
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                color: '#666'
             }}>
                <EditOutlined style={{ fontSize: 14 }} />
             </div>
          </div>
        </Popover>
      </ProFormItem>

      {initialValues?.id && (
        <ProFormRadio.Group
          name="status"
          label="状态"
          initialValue="1"
          options={defaultStatusDict.length > 0 ? defaultStatusDict : [
            { label: '启用', value: '1' },
            { label: '禁用', value: '0' },
          ]}
          rules={[{ required: true, message: '请选择状态' }]}
        />
      )}

      <ProFormDigit
        name="sort_order"
        label="排序"
        placeholder="请输入排序号"
        fieldProps={{ precision: 0 }}
      />

      <ProFormTextArea
        name="description"
        label="应用描述"
        placeholder="请输入应用描述"
        fieldProps={{ rows: 3, showCount: true, maxLength: 200 }}
      />
    </ModalForm>
  );
};

export default AppForm;
