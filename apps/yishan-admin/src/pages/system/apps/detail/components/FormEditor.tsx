import React, { useState, useEffect } from 'react';
import { Button, Input, Space, Row, Col, message, Spin } from 'antd';
import { ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { updateForm, getFormDetail } from '@/services/yishan-admin/sysForms';
import { PlusOutlined, UploadOutlined, DownloadOutlined, EllipsisOutlined } from '@ant-design/icons';

interface FormEditorProps {
  appId: number;
  formId: number;
}

const FormEditor: React.FC<FormEditorProps> = ({ appId, formId }) => {
  const [viewMode, setViewMode] = useState<'data' | 'design'>('data');
  const [schemaStr, setSchemaStr] = useState<string>('{}');
  const [loading, setLoading] = useState(false);
  const [formName, setFormName] = useState('');

  useEffect(() => {
    if (appId && formId) {
      loadDetail();
    }
  }, [appId, formId]);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const res = await getFormDetail({ appId, formId });
      if (res.data) {
        setFormName(res.data.name);
        if (res.data.config) {
          setSchemaStr(JSON.stringify(res.data.config, null, 2));
        } else {
          setSchemaStr(JSON.stringify({
            type: 'object',
            properties: {
              input: {
                title: '示例输入框',
                type: 'string',
                widget: 'input'
              }
            }
          }, null, 2));
        }
      }
    } catch (_error) {
      message.error('加载表单详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const config = JSON.parse(schemaStr);
      await updateForm({ appId, formId }, { config });
      message.success('保存成功');
    } catch (_error) {
      message.error('保存失败: JSON 格式错误或网络错误');
    }
  };

  // 模拟数据列定义
  const columns: ProColumns<any>[] = [
    {
      title: '实例标题',
      dataIndex: 'title',
      valueType: 'text',
    },
    {
      title: '提交人',
      dataIndex: 'submitter',
      valueType: 'text',
    },
    {
      title: '提交人组织',
      dataIndex: 'department',
      valueType: 'text',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
    },
    {
      title: '修改时间',
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
    },
    {
      title: '实例ID',
      dataIndex: 'id',
      valueType: 'text',
      search: false,
    },
  ];

  if (viewMode === 'data') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff' }}>
        <ProTable
          headerTitle={formName}
          rowKey="id"
          search={{
            labelWidth: 'auto',
          }}
          toolBarRender={() => [
            <Button key="create" type="primary" icon={<PlusOutlined />}>
              新增
            </Button>,
            <Button key="import" icon={<UploadOutlined />}>
              导入
            </Button>,
            <Button key="export" icon={<DownloadOutlined />}>
              导出
            </Button>,
            <Button key="more" icon={<EllipsisOutlined />}>
              更多
            </Button>,
            <Button key="design" type="primary" onClick={() => setViewMode('design')}>
              编辑表单
            </Button>,
          ]}
          request={async () => {
            // 模拟空数据
            return {
              data: [],
              success: true,
              total: 0,
            };
          }}
          columns={columns}
          rowSelection={{}}
          tableAlertRender={({ selectedRowKeys, onCleanSelected }) => (
            <Space size={24}>
              <span>
                已选 {selectedRowKeys.length} 项
                <a style={{ marginLeft: 8 }} onClick={onCleanSelected}>
                  取消选择
                </a>
              </span>
            </Space>
          )}
        />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
        <h3 style={{ margin: 0 }}>{formName} - 表单设计</h3>
        <Space>
          <Button onClick={() => setViewMode('data')}>返回数据</Button>
          <Button onClick={loadDetail}>重置</Button>
          <Button type="primary" onClick={handleSave} loading={loading}>保存配置</Button>
        </Space>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Spin spinning={loading} style={{ height: '100%' }}>
          <Row style={{ height: '100%' }}>
            <Col span={12} style={{ height: '100%', borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '8px 16px', background: '#fafafa', borderBottom: '1px solid #f0f0f0', fontWeight: 500 }}>Schema 编辑 (JSON)</div>
              <Input.TextArea
                value={schemaStr}
                onChange={(e) => setSchemaStr(e.target.value)}
                style={{ flex: 1, resize: 'none', borderRadius: 0, border: 'none', fontFamily: 'monospace', padding: 16 }}
              />
            </Col>
            <Col span={12} style={{ height: '100%', overflow: 'auto', padding: 24, background: '#fff' }}>
               <div style={{ marginBottom: 16, fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: 8 }}>预览区域</div>
               <SafeRender schemaStr={schemaStr} />
            </Col>
          </Row>
        </Spin>
      </div>
    </div>
  );
};

const SafeRender = ({ schemaStr }: { schemaStr: string }) => {
  try {
    const schema = JSON.parse(schemaStr);
    return <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{JSON.stringify(schema, null, 2)}</div>;
  } catch (_e) {
    return <div style={{ color: 'red' }}>JSON 格式错误，无法预览</div>;
  }
};

export default FormEditor;
