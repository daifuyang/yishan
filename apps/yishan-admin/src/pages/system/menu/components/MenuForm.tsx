import React, { useEffect, useMemo, useState } from 'react';
import type { FormInstance } from 'antd';
import { getMenuTree } from '@/services/yishan-admin/sysMenus';
import { ModalForm, ProFormText, ProFormDigit, ProFormRadio, ProFormTreeSelect, ProFormDependency, ProFormSwitch } from '@ant-design/pro-components';

type MenuType = 0 | 1 | 2;
type MenuTreeData = Omit<API.menuTreeNode, 'children'> & { children?: MenuTreeData[] };
type MenuFormValues = {
    name: string;
    type: MenuType;
    parentId?: number;
    path?: string;
    icon?: string;
    component?: string;
    status: 0 | 1;
    sort_order: number;
    hideInMenu: boolean;
    isExternalLink: boolean;
    perm?: string;
    keepAlive?: boolean;
};

export interface MenuFormProps {
    form: FormInstance<MenuFormValues>;
    open: boolean;
    title: string;
    initialValues?: API.sysMenu;
    onCancel: () => void;
    onSubmit: (values: API.saveMenuReq | API.updateMenuReq) => Promise<void>;
    confirmLoading: boolean;
}

const MenuForm: React.FC<MenuFormProps> = ({
    form,
    open,
    title,
    initialValues,
    onCancel,
    onSubmit,
    confirmLoading,
}) => {
    const [treeLoading, setTreeLoading] = useState(false);
    const [treeData, setTreeData] = useState<MenuTreeData[]>([]);


    const buildTree = (nodes: API.menuTreeNode[] = []): MenuTreeData[] => {
        return nodes.map((n) => ({
            ...n,
            children: n.children ? buildTree(n.children) : undefined,
        }));
    };

    const fetchTree = async () => {
        try {
            setTreeLoading(true);
            const res = await getMenuTree();
            const nodes = buildTree(res.data || []);
            const topNode: MenuTreeData = {
                id: 0,
                name: '顶级菜单',
                type: 0,
                status: 1,
                sort_order: 0,
                hideInMenu: false,
                isExternalLink: false,
                keepAlive: false,
                createdAt: '',
                updatedAt: '',
            };
            setTreeData([topNode, ...nodes]);
        } catch {
            setTreeData([]);
        } finally {
            setTreeLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchTree();
        }
    }, [open]);

    const initialVals: MenuFormValues = useMemo(() => (
        initialValues
            ? {
                name: initialValues.name,
                type: initialValues.type,
                parentId: initialValues.parentId ?? 0,
                path: initialValues.path,
                icon: initialValues.icon,
                component: initialValues.component,
                status: (initialValues.status ?? 1) as 0 | 1,
                sort_order: Number(initialValues.sort_order ?? 0),
                hideInMenu: initialValues.hideInMenu ?? false,
                isExternalLink: initialValues.isExternalLink ?? false,
                perm: initialValues.perm,
                keepAlive: initialValues.keepAlive ?? false,
            }
            : { name: '', type: 0, parentId: 0, status: 1, sort_order: 0, hideInMenu: false, isExternalLink: false, keepAlive: false }
    ), [initialValues]);

    return (
        <ModalForm<MenuFormValues>
            form={form}
            title={title}
            open={open}
            onOpenChange={(o) => { if (!o) onCancel(); }}
            modalProps={{ destroyOnClose: true, maskClosable: false, confirmLoading }}
            autoFocusFirstInput
            grid
            initialValues={initialVals}
            syncToInitialValues
            onFinish={async (values) => {
                const payload: API.saveMenuReq = {
                    name: values.name,
                    type: values.type,
                    parentId: values.parentId === 0 ? undefined : values.parentId,
                    path: values.path,
                    icon: values.icon,
                    component: values.component,
                    status: values.status,
                    sort_order: Number(values.sort_order ?? 0),
                    hideInMenu: values.hideInMenu,
                    isExternalLink: values.isExternalLink,
                    perm: values.perm,
                    keepAlive: values.keepAlive,
                };
                await onSubmit(payload);
                return true;
            }}
        >
            <ProFormTreeSelect
                name="parentId"
                label="上级菜单"
                colProps={{ span: 24 }}
                fieldProps={{
                    treeData: treeData,
                    fieldNames: { label: 'name', value: 'id', children: 'children' },
                    allowClear: true,
                    treeDefaultExpandAll: true,
                    disabled: treeLoading,
                    style: { width: '100%' },
                    showSearch: true,
                }}
            />

            <ProFormRadio.Group
                name="type"
                label="菜单类型"
                colProps={{ span: 24 }}
                options={[
                    { label: '目录', value: 0 },
                    { label: '菜单', value: 1 },
                    { label: '按钮', value: 2 },
                ]}
                rules={[{ required: true, message: '请选择菜单类型' }]}
            />

            {/* 使用 ProFormDependency 联动显示 */}
            <ProFormDependency name={["type"]}>
                {({ type }: { type?: MenuType }) => {
                    const isDir = type === 0;
                    const isMenu = type === 1;
                    const isButton = type === 2;
                    return (
                        <>
                            {(isDir || isMenu) && (
                                <ProFormText name="icon" label="菜单图标" placeholder="点击选择图标" colProps={{ span: 12 }} />
                            )}
                            <ProFormDigit name="sort_order" label="显示排序" placeholder="请输入排序值" rules={[{ required: true, message: '请输入排序值' }]} colProps={{ span: 12 }} fieldProps={{ min: 0 }} />

                            <ProFormText name="name" label="菜单名称" placeholder="请输入菜单名称" rules={[{ required: true, message: '请输入菜单名称' }, { max: 50, message: '最多50个字符' }]} colProps={{ span: 12 }} />
                            {(isDir || isMenu) && (
                                <ProFormText name="path" label="路由地址" placeholder="请输入路由地址" colProps={{ span: 12 }} />
                            )}

                            {(isDir || isMenu) && (
                                <ProFormSwitch name="isExternalLink" label="是否外链" colProps={{ span: 12 }} />
                            )}
                            {isMenu && (
                                <ProFormText name="component" label="组件路径" placeholder="请输入前端组件路径（如 ./system/menu）" colProps={{ span: 12 }} />
                            )}

                            <ProFormSwitch name="hideInMenu" label="显示状态" colProps={{ span: 12 }} />
                            <ProFormRadio.Group name="status" label="菜单状态" options={[{ label: '正常', value: 1 }, { label: '停用', value: 0 }]} rules={[{ required: true, message: '请选择状态' }]} colProps={{ span: 12 }} />

                            {isButton && (
                                <ProFormText name="perm" label="权限标识" placeholder="请输入权限标识（如 system:menu:list）" colProps={{ span: 24 }} />
                            )}
                            {isMenu && (
                                <ProFormSwitch name="keepAlive" label="是否缓存" colProps={{ span: 12 }} />
                            )}
                        </>
                    );
                }}
            </ProFormDependency>
        </ModalForm>
    );
};

export default MenuForm;