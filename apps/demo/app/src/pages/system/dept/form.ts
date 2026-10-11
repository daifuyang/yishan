import type { AdminDept } from "@/api/admin/types";

export interface DepartmentFormValues {
  name: string;
  parentId: string;
  status: "0" | "1";
  sort: string;
  description: string;
  leaderId: string;
}

export function departmentParentOptions(tree: AdminDept[], editedId?: number) {
  const options = [{ label: "顶级部门", value: "0" }];
  const visit = (nodes: AdminDept[], depth: number) => {
    for (const node of nodes) {
      if (node.id === editedId) continue;
      options.push({ label: `${"　".repeat(depth)}${node.name}`, value: String(node.id) });
      visit(node.children || [], depth + 1);
    }
  };
  visit(tree, 0);
  return options;
}

export function departmentPayload(values: DepartmentFormValues) {
  const name = values.name.trim();
  if (!name || name.length > 100) throw new Error("请输入 1–100 字的部门名称");
  const parentId = Number(values.parentId);
  const sort_order = Number(values.sort);
  if (!Number.isInteger(parentId) || parentId < 0) throw new Error("请选择上级部门");
  if (!values.sort.trim() || !Number.isInteger(sort_order) || sort_order < 0)
    throw new Error("排序须为非负整数");
  if (values.description.length > 255) throw new Error("部门描述最多 255 字");
  const leaderId = values.leaderId.trim() ? Number(values.leaderId) : undefined;
  if (leaderId !== undefined && (!Number.isInteger(leaderId) || leaderId < 1))
    throw new Error("负责人 ID 须为正整数");
  return {
    name,
    ...(parentId === 0 ? {} : { parentId }),
    status: values.status,
    sort_order,
    description: values.description,
    ...(leaderId === undefined ? {} : { leaderId }),
  };
}
