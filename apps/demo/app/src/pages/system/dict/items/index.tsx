import { useRouter } from "@tarojs/taro";
import { useRequireAuth } from "@/utils/auth-guard";
import { useAuthStore } from "@/stores/auth";
import { PageContainer } from "@/components/layout";
import { AdminPage, AdminNotice } from "../../_shared/AdminUI";
import DictionaryList from "../DictionaryList";

export default function DictItemsPage() {
  const guard = useRequireAuth({ moduleId: "system-dict" });
  const typeId = Number(useRouter().params.typeId);
  const identity = useAuthStore((state) => state.user?.id);
  if (!guard.ready || !guard.allowed) return <PageContainer>{null}</PageContainer>;
  if (!Number.isInteger(typeId) || typeId < 1)
    return (
      <AdminPage title="字典项">
        <AdminNotice>字典类型参数无效</AdminNotice>
      </AdminPage>
    );
  return (
    <DictionaryList
      key={`${identity}:${typeId}`}
      typeId={typeId}
      enabled={guard.ready && guard.allowed}
    />
  );
}
