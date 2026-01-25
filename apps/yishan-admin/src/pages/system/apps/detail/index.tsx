import { PageContainer } from '@ant-design/pro-components';
import { Card, Layout, Modal, Form, Input, message } from 'antd';
import React, { useState } from 'react';
import { useParams, history } from '@umijs/max';
import WelcomeBoard from './components/WelcomeBoard';
import ResourceList from './components/ResourceList';
import FormEditor from './components/FormEditor';
import { createForm } from '@/services/yishan-admin/sysForms';
import { createAppResource } from '@/services/yishan-admin/sysAppResources';

const { Sider, Content } = Layout;

const AppDetail: React.FC = () => {
  const params = useParams();
  const id = Number(params.id);
  const [selectedResourceId, setSelectedResourceId] = useState<number>();
  const [selectedResourceType, setSelectedResourceType] = useState<string>();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [createType, setCreateType] = useState<string>('FORM');
  const [createParentId, setCreateParentId] = useState<number>();
  const [form] = Form.useForm();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleCreateClick = (type?: string, parentId?: number) => {
    setCreateType(type || 'FORM');
    setCreateParentId(parentId);
    setIsModalVisible(true);
    form.resetFields();
  };

  const handleCreateSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (createType === 'FORM') {
        // Create form
        await createForm({ appId: id }, { name: values.name, status: '1' });
      } else {
        // Create generic resource or folder
        await createAppResource({ appId: id }, { 
          name: values.name, 
          type: createType as any, 
          parentId: createParentId,
          status: '1' 
        });
      }
      message.success('创建成功');
      setIsModalVisible(false);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error(error);
      message.error('创建失败');
    }
  };

  const renderContent = () => {
    if (!selectedResourceId) {
      return <WelcomeBoard onCreate={handleCreateClick} />;
    }

    if (selectedResourceType === 'FORM') {
      return <FormEditor appId={id} formId={selectedResourceId} />;
    }

    return (
      <Card style={{ margin: 24 }}>
        <div>功能开发中: {selectedResourceType}</div>
      </Card>
    );
  };

  return (
    <PageContainer
      header={{
        title: `应用详情`,
        onBack: () => history.back(),
      }}
      style={{ height: 'calc(100vh - 56px)' }}
    >
      <Layout style={{ height: 'calc(100vh - 110px)', background: '#fff' }}>
        <Sider width={256} theme="light">
          <ResourceList
            appId={id}
            selectedId={selectedResourceId}
            onSelect={(r) => {
              setSelectedResourceId(r.id);
              setSelectedResourceType(r.type);
            }}
            onCreate={handleCreateClick}
            refreshTrigger={refreshTrigger}
          />
        </Sider>
        <Content style={{ height: '100%', overflow: 'hidden' }}>
          {renderContent()}
        </Content>
      </Layout>

      <Modal
        title={createType === 'FOLDER' ? '新建分组' : `新建${createType === 'FORM' ? '表单' : '资源'}`}
        open={isModalVisible}
        onOk={handleCreateSubmit}
        onCancel={() => setIsModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="请输入名称" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default AppDetail;
