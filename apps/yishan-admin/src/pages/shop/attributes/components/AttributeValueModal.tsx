import React, { useState } from "react";
import { Button, Popconfirm, Space, message } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { ProTable, type ProColumns } from "@ant-design/pro-components";
import { ModalForm, ProFormText } from "@ant-design/pro-components";
import {
  getAttributeDetail,
  createAttributeValue,
  updateAttributeValue,
  deleteAttributeValue,
} from "@/services/yishan-admin/shop";

interface ShopAttributeValue {
  id: number;
  attributeId: number;
  value: string;
  image?: string;
  sortOrder: number;
  status: string;
  creatorId: number;
  createdAt: string;
}

export interface AttributeValueModalProps {
  attributeId: number;
  attributeName: string;
  trigger?: JSX.Element;
}

const AttributeValueModal: React.FC<AttributeValueModalProps> = ({
  attributeId,
  attributeName,
  trigger,
}) => {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const actionRef = React.useRef<any>(undefined);

  const loadValues = async () => {
    actionRef.current?.reload();
  };

  const handleAdd = async (values: { value: string }) => {
    const res = await createAttributeValue(
      { id: attributeId },
      { value: values.value.trim() }
    );
    if (res.success) {
      message.success("添加成功");
      return true;
    }
    return false;
  };

  const handleUpdate = async (id: number, value: string) => {
    const res = await updateAttributeValue(
      { valueId: id },
      { value: value.trim() }
    );
    if (res.success) {
      message.success("更新成功");
      setEditingId(null);
      loadValues();
    }
  };

  const handleDelete = async (id: number) => {
    const res = await deleteAttributeValue({ valueId: id });
    if (res.success) {
      message.success("删除成功");
      loadValues();
    }
  };

  const columns: ProColumns<ShopAttributeValue>[] = [
    { title: "ID", dataIndex: "id", key: "id", width: 80 },
    { title: "属性值", dataIndex: "value", key: "value" },
    { title: "排序", dataIndex: "sortOrder", key: "sortOrder", width: 100 },
    {
      title: "操作",
      key: "action",
      width: 150,
      render: (_, record) => (
        <Space>
          {editingId === record.id ? (
            <>
              <Button type="link" size="small" onClick={() => handleUpdate(record.id, record.value)}>
                保存
              </Button>
              <Button type="link" size="small" onClick={() => setEditingId(null)}>
                取消
              </Button>
            </>
          ) : (
            <>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => setEditingId(record.id)}
              >
                编辑
              </Button>
              <Popconfirm title="确定要删除吗？" onConfirm={() => handleDelete(record.id)}>
                <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <ModalForm
        title={`管理属性值 - ${attributeName}`}
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (isOpen) {
            loadValues();
          }
        }}
        width={600}
        submitter={{
          searchConfig: {
            submitText: "添加",
            resetText: "重置",
          },
          submitButtonProps: {
            icon: <PlusOutlined />,
          },
        }}
        modalProps={{ destroyOnClose: true }}
        onFinish={async (values) => {
          const success = await handleAdd(values as { value: string });
          if (success) {
            loadValues();
          }
          return success;
        }}
      >
        <ProFormText
          name="value"
          label="属性值"
          placeholder="请输入属性值"
          rules={[{ required: true, message: "请输入属性值" }]}
        />
        <ProTable<ShopAttributeValue>
          actionRef={actionRef}
          rowKey="id"
          search={false}
          toolBarRender={false}
          columns={columns}
          request={async () => {
            const res = await getAttributeDetail({ id: attributeId });
            return {
              data: res.data?.values || [],
              success: res.success,
            };
          }}
          pagination={false}
        />
      </ModalForm>
    </>
  );
};

export default AttributeValueModal;
