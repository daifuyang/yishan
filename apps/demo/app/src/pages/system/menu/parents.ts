import type { AdminMenu } from "@/api/admin/menu";

export function menuParentOptions(
  nodes: readonly AdminMenu[],
  selfId?: number,
): { value: string; label: string }[] {
  return nodes.flatMap((node) =>
    node.id === selfId
      ? []
      : [
          { value: String(node.id), label: node.name },
          ...menuParentOptions(node.children || [], selfId),
        ],
  );
}
