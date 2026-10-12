import type { AdminAppMenu } from "@/api/admin/appMenu";

export function moveAppMenu(
  tree: readonly AdminAppMenu[],
  record: Pick<AdminAppMenu, "id" | "parentId">,
  direction: -1 | 1,
) {
  const siblings =
    record.parentId == null
      ? tree
      : tree.find((group) => group.id === record.parentId)?.children || [];
  const index = siblings.findIndex((item) => item.id === record.id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= siblings.length) return null;
  const orderedIds = siblings.map((item) => item.id);
  [orderedIds[index], orderedIds[target]] = [orderedIds[target], orderedIds[index]];
  return { parentId: record.parentId, orderedIds };
}
