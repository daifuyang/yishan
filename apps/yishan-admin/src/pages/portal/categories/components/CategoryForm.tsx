import React, { useRef, useState } from "react";
import { ModalForm, ProFormText, ProFormDigit, ProFormRadio, ProFormTreeSelect, ProFormTextArea, type ProFormInstance } from "@ant-design/pro-components";
import { useModel } from "@umijs/max";
import { getCategoryList, getCategoryDetail, createCategory, updateCategory } from "@/services/yishan-admin/portalCategories";

type CategoryTreeNode = Omit<API.portalCategory, "children"> & { children?: CategoryTreeNode[] };

export interface CategoryFormProps {
  title: string;
  trigger?: JSX.Element;
  initialValues?: Partial<API.portalCategory>;
  onFinish?: () => Promise<void>;
}

const CategoryForm: React.FC<CategoryFormProps> = ({ title, trigger, initialValues = { status: "1", sort_order: 0, parentId: 0 }, onFinish }) => {
  const { initialState } = useModel("@@initialState");
  const dictDataMap = initialState?.dictDataMap || {};
  const defaultStatusDict: Array<{ label: string; value: string }> = dictDataMap.default_status || [];
  const formRef = useRef<ProFormInstance>(null);
  const [treeData, setTreeData] = useState<CategoryTreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);

  const buildTree = (list: API.portalCategory[] = []) => {
    const nodes: Record<number, CategoryTreeNode> = {};
    const roots: CategoryTreeNode[] = [];
    list.forEach((c) => { nodes[c.id] = { ...c }; });
    list.forEach((c) => {
      const pid = Number(c.parentId || 0);
      if (pid === 0 || !nodes[pid]) {
        roots.push(nodes[c.id]);
      } else {
        const p = nodes[pid];
        if (!p.children) p.children = [];
        p.children.push(nodes[c.id]);
      }
    });
    const top: CategoryTreeNode = { id: 0, name: "顶级分类", status: "1", sort_order: 0, createdAt: "", updatedAt: "" } as any;
    return [top, ...roots];
  };

  const fetchTree = async () => {
    try {
      setTreeLoading(true);
      const res = await getCategoryList({ page: 1, pageSize: 100, sortBy: "sort_order", sortOrder: "asc" });
      setTreeData(buildTree(res.data || []));
    } finally {
      setTreeLoading(false);
    }
  };

  const fetchDetail = async (id: number) => {
    const res = await getCategoryDetail({ id });
    if (res.success && res.data) formRef.current?.setFieldsValue(res.data);
  };

  const handleFinish = async (values: any) => {
    const basePayload: any = {
      name: values.name,
      slug: values.slug,
      parentId: values.parentId === 0 ? undefined : values.parentId,
      status: values.status,
      sort_order: Number(values.sort_order ?? 0),
      description: values.description,
    };
    if (!initialValues?.id) {
      const res = await createCategory(basePayload as API.saveCategoryReq);
      if (res.success) { await onFinish?.(); return true; }
      return false;
    }
    const res = await updateCategory({ id: Number(initialValues.id) }, basePayload as API.updateCategoryReq);
    if (res.success) { await onFinish?.(); return true; }
    return false;
  };

  if (!trigger) return null;

  return (
    <ModalForm
      title={title}
      trigger={trigger}
      autoFocusFirstInput
      grid
      formRef={formRef}
      initialValues={initialValues}
      modalProps={{ destroyOnClose: true, maskClosable: false }}
      onOpenChange={(o) => {
        if (o) {
          fetchTree();
          if (initialValues?.id) fetchDetail(initialValues.id);
        }
      }}
      onFinish={handleFinish}
    >
      <ProFormTreeSelect
        name="parentId"
        label="上级分类"
        colProps={{ span: 24 }}
        fieldProps={{
          treeData,
          fieldNames: { label: "name", value: "id", children: "children" },
          allowClear: true,
          treeDefaultExpandAll: true,
          disabled: treeLoading,
          style: { width: "100%" },
          showSearch: true,
        }}
      />
      <ProFormText name="name" label="分类名称" placeholder="请输入分类名称" colProps={{ span: 12 }} />
      <ProFormText name="slug" label="URL标识" placeholder="请输入URL标识" colProps={{ span: 12 }} />
      <ProFormDigit name="sort_order" label="排序" colProps={{ span: 12 }} fieldProps={{ min: 0 }} />
      <ProFormRadio.Group name="status" label="状态" options={defaultStatusDict} colProps={{ span: 12 }} />
      <ProFormTextArea name="description" label="描述" placeholder="请输入描述" colProps={{ span: 24 }} />
    </ModalForm>
  );
};

export default CategoryForm;
