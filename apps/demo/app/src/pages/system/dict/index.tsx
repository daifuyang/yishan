import { useRequireAuth } from "@/utils/auth-guard";
import { useAuthStore } from "@/stores/auth";
import { PageContainer } from "@/components/layout";
import DictionaryList from "./DictionaryList";

export default function DictIndexPage() {
  const guard = useRequireAuth({ moduleId: "system-dict" });
  const identity = useAuthStore((state) => state.user?.id);
  if (!guard.ready || !guard.allowed) return <PageContainer>{null}</PageContainer>;
  return <DictionaryList key={identity} enabled={guard.ready && guard.allowed} />;
}
