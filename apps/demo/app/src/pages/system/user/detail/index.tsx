import { useState, useEffect, useRef } from "react";
import { View, Text, Input } from "@tarojs/components";
import Taro, { useRouter, useDidShow, useDidHide } from "@tarojs/taro";

import { Avatar, Tag } from "@/components/atoms";
import { PageHeader } from "@/components/molecules";
import { StateView } from "@/components/feedback";
import { PageContainer } from "@/components/layout";
import { useRequireAuth } from "@/utils/auth-guard";
import { navigateTo, navigateBack } from "@/utils/router";
import { useCanWrite, confirmAction } from "@/hooks";
import { adminUserApi, adminRoleApi, adminDeptApi } from "@/api";
import type { AdminUser } from "@/api/admin/types";
import { PERMS, SYSTEM_PAGES } from "@/constants/routes";
import { formatDateTime } from "@/utils/format";

import styles from "./index.module.scss";

// 与已有登录/工作台图标一致，使用小程序兼容的 SVG 背景图（Lucide, ISC）。
const ICONS = {
  pencil: '<path d="m16 3 5 5M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15Z"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  ellipsis:
    '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  keyRound: '<circle cx="8" cy="8" r="5"/><path d="m11.5 11.5 9 9M15 15l3-3M18 18l3-3"/>',
  trash: '<path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
} as const;

function DetailIcon({ name, color = "#4E5969" }: { name: keyof typeof ICONS; color?: string }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
  return (
    <View
      className={styles.icon}
      style={{ backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")` }}
    />
  );
}

function DetailRow({ label, value }: { label: string; value?: string | number }) {
  return (
    <View className={styles.row}>
      <Text className={styles.row__label}>{label}</Text>
      <Text className={styles.row__value} selectable>
        {value === undefined || value === "" ? "未设置" : value}
      </Text>
    </View>
  );
}

function associationText(ids: number[] | undefined, names: Record<number, string>) {
  if (!ids?.length) return "未设置";
  const available = ids.map((id) => names[id]).filter(Boolean);
  if (available.length < ids.length) available.push("名称暂不可用");
  return available.join("、");
}

export default function UserDetailPage() {
  const guard = useRequireAuth({ moduleId: "system-user" });
  const router = useRouter();
  const id = Number(router.params.id);
  const canUpdate = useCanWrite(PERMS.userUpdate);
  const canDelete = useCanWrite(PERMS.userDelete);
  const canReadRoles = useCanWrite("system:role:list");
  const canReadDepts = useCanWrite(PERMS.deptList);

  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleNames, setRoleNames] = useState<Record<number, string>>({});
  const [deptNames, setDeptNames] = useState<Record<number, string>>({});
  const [moreOpen, setMoreOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const submittingRef = useRef(false);
  const loadSequence = useRef(0);
  const refreshOnShow = useRef(false);

  const load = async () => {
    if (!guard.ready || !guard.allowed || submittingRef.current) return;
    const sequence = ++loadSequence.current;
    if (!Number.isInteger(id) || id <= 0) {
      setError("用户ID缺失或无效");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await adminUserApi.getAdminUser(id);
      if (sequence === loadSequence.current) setUser(data);
    } catch (e) {
      if (sequence === loadSequence.current) setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    setUser(null);
    void load();
    return () => {
      loadSequence.current++;
    };
  }, [id, guard.ready, guard.allowed]);

  useDidShow(() => {
    if (refreshOnShow.current) {
      refreshOnShow.current = false;
      void load();
    }
  });

  useDidHide(() => {
    refreshOnShow.current = true;
    setMoreOpen(false);
    setPasswordOpen(false);
    setPassword("");
  });

  const roleKey = user?.roleIds?.join(",") || "";
  const deptKey = user?.deptIds?.join(",") || "";
  useEffect(() => {
    let active = true;
    setRoleNames({});
    setDeptNames({});
    const resolveNames = async (
      ids: string,
      allowed: boolean,
      fetchName: (id: number) => Promise<{ id: number; name: string }>,
      setNames: (names: Record<number, string>) => void,
    ) => {
      if (!ids || !allowed || !guard.allowed) return;
      const results = await Promise.allSettled(
        ids.split(",").map((value) => fetchName(Number(value))),
      );
      const names: Record<number, string> = {};
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.name)
          names[result.value.id] = result.value.name;
      }
      if (active) setNames(names);
    };
    void resolveNames(roleKey, canReadRoles, adminRoleApi.getAdminRole, setRoleNames);
    void resolveNames(deptKey, canReadDepts, adminDeptApi.getAdminDept, setDeptNames);
    return () => {
      active = false;
    };
  }, [roleKey, deptKey, canReadRoles, canReadDepts, guard.allowed]);

  const handleEdit = () => {
    if (!user || !canUpdate || submittingRef.current || loading) return;
    navigateTo(`/${SYSTEM_PAGES.userEdit}?id=${user.id}`);
  };

  const handleToggleStatus = async () => {
    if (!user || !canUpdate || submittingRef.current || loading) return;
    submittingRef.current = true;
    setSubmitting(true);
    const next = user.status === "1" ? "0" : "1";
    try {
      const ok = await confirmAction({
        title: next === "1" ? "启用用户" : "禁用用户",
        content: `确认要${next === "1" ? "启用" : "禁用"}「${user.realName || user.username || user.phone}」吗？`,
        confirmText: next === "1" ? "启用" : "禁用",
        confirmColor: next === "1" ? "#1677FF" : "#F53F3F",
      });
      if (!ok) return;
      const updated = await adminUserApi.updateAdminUser(user.id, { status: next });
      setUser(updated);
      Taro.showToast({ title: "操作成功", icon: "success" });
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "操作失败", icon: "none" });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (input?: string) => {
    if (!user || !canUpdate || submittingRef.current || loading) return;
    setMoreOpen(false);
    if (process.env.TARO_ENV === "h5" && input === undefined) {
      setPassword("");
      setPasswordError("");
      setPasswordOpen(true);
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      let newPassword = input?.trim() || "";
      if (input === undefined) {
        // 微信支持 editable/content，当前 Taro 公共声明未包含这两个扩展字段。
        const res = await Taro.showModal({
          title: "重置密码",
          content: `为「${user.realName || user.username || user.phone}」设置新密码（6-50 位，必须含字母+数字）`,
          editable: true,
          placeholderText: "新密码",
          confirmText: "确定",
          confirmColor: "#1677FF",
        } as Parameters<typeof Taro.showModal>[0]);
        if (!res.confirm) return;
        newPassword = ((res as { content?: string }).content || "").trim();
      }
      setPasswordError("");
      if (newPassword.length < 6 || newPassword.length > 50) {
        setPasswordError("密码须为 6-50 位");
        Taro.showToast({ title: "密码须为 6-50 位", icon: "none" });
        return;
      }
      if (!/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
        setPasswordError("密码必须含字母+数字");
        Taro.showToast({ title: "密码必须含字母+数字", icon: "none" });
        return;
      }
      await adminUserApi.resetAdminUserPassword(user.id, newPassword);
      setPasswordOpen(false);
      setPassword("");
      Taro.showToast({ title: "密码已重置", icon: "success" });
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : "重置失败");
      Taro.showToast({ title: e instanceof Error ? e.message : "重置失败", icon: "none" });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !canDelete || submittingRef.current || loading) return;
    if (user.id === 1) {
      Taro.showToast({ title: "系统管理员不可删除", icon: "none" });
      return;
    }
    setMoreOpen(false);
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const ok = await confirmAction({
        title: "删除用户",
        content: `确认删除「${user.realName || user.username || user.phone}」？该操作不可恢复。`,
        confirmText: "删除",
        confirmColor: "#F53F3F",
      });
      if (!ok) return;
      await adminUserApi.deleteAdminUser(user.id);
      setUser(null);
      Taro.showToast({ title: "已删除", icon: "success" });
      setTimeout(() => navigateBack(1), 600);
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "删除失败", icon: "none" });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (!guard.ready || !guard.allowed) return <PageContainer>{null}</PageContainer>;

  const kind = error ? "error" : loading && !user ? "loading" : !user ? "empty" : "ready";
  const hasMore = canUpdate || (canDelete && user?.id !== 1);
  const hasActions = Boolean(user && (canUpdate || hasMore));
  const disabled = submitting || loading;
  const organizationSummary = [
    user?.roleIds
      ?.map((roleId) => roleNames[roleId])
      .filter(Boolean)
      .join("、"),
    user?.deptIds
      ?.map((deptId) => deptNames[deptId])
      .filter(Boolean)
      .join("、"),
  ]
    .filter(Boolean)
    .join(" · ");
  const lastLoginIp = user?.lastLoginIp;
  const loginIp =
    lastLoginIp && ["::1", "127.0.0.1", "::ffff:127.0.0.1"].includes(lastLoginIp)
      ? "本机地址"
      : lastLoginIp;

  return (
    <View className={`${styles.page} ${hasActions ? styles.pageWithActions : ""}`}>
      {process.env.TARO_ENV === "h5" ? <PageHeader title="用户详情" /> : null}
      <View className={styles.detail}>
        <StateView
          kind={kind}
          text={error || (kind === "empty" ? "用户不存在" : undefined)}
          onRetry={load}
          minHeight={300}
        >
          {user ? (
            <>
              <View className={styles.hero}>
                <Avatar
                  src={user.avatar}
                  name={user.realName || user.username || user.phone}
                  size="lg"
                  shape="circle"
                  className={styles.hero__avatar}
                />
                <View className={styles.hero__info}>
                  <View className={styles.hero__nameLine}>
                    <Text className={styles.hero__name}>
                      {user.realName || user.username || user.phone}
                    </Text>
                    <Tag
                      variant={
                        user.status === "1"
                          ? "success"
                          : user.status === "0"
                            ? "default"
                            : "warning"
                      }
                    >
                      {user.status === "1" ? "启用" : user.status === "0" ? "禁用" : "锁定"}
                    </Tag>
                    {user.genderName ? (
                      <Text className={styles.hero__gender}>{user.genderName}</Text>
                    ) : null}
                  </View>
                  {user.username ? (
                    <Text className={styles.hero__account}>@{user.username}</Text>
                  ) : null}
                  {organizationSummary ? (
                    <Text className={styles.hero__organization}>{organizationSummary}</Text>
                  ) : null}
                </View>
              </View>
              <View className={styles.group}>
                <Text className={styles.group__title}>基本信息</Text>
                <DetailRow label="手机号" value={user.phone} />
                <DetailRow label="邮箱" value={user.email} />
                <DetailRow label="昵称" value={user.nickname} />
                <DetailRow label="出生日期" value={user.birthDate} />
              </View>
              <View className={styles.group}>
                <Text className={styles.group__title}>组织信息</Text>
                <DetailRow
                  label="所属部门"
                  value={associationText(user.deptIds, canReadDepts ? deptNames : {})}
                />
                <DetailRow
                  label="用户角色"
                  value={associationText(user.roleIds, canReadRoles ? roleNames : {})}
                />
              </View>
              <View className={styles.group}>
                <Text className={styles.group__title}>账号记录</Text>
                <DetailRow label="用户 ID" value={user.id} />
                <DetailRow
                  label="最后登录"
                  value={user.lastLoginTime ? formatDateTime(user.lastLoginTime) : "未登录"}
                />
                <DetailRow label="登录次数" value={user.loginCount} />
                <DetailRow label="创建人" value={user.creatorName} />
                <DetailRow label="登录 IP" value={loginIp} />
                <DetailRow label="创建时间" value={formatDateTime(user.createdAt)} />
                <DetailRow label="更新人" value={user.updaterName} />
                <DetailRow label="更新时间" value={formatDateTime(user.updatedAt)} />
              </View>
            </>
          ) : null}
        </StateView>
      </View>
      {hasActions && user ? (
        <View className={styles.actions}>
          <View className={styles.actions__content}>
            {canUpdate ? (
              <>
                <View
                  className={`${styles.action} ${styles.actionPrimary} ${disabled ? styles.actionDisabled : ""}`}
                  aria-label="编辑"
                  aria-disabled={disabled}
                  onClick={disabled ? undefined : handleEdit}
                  hoverClass={styles.actionPressed}
                >
                  <DetailIcon name="pencil" color="#1677FF" />
                  <Text>编辑</Text>
                </View>
                <View
                  className={`${styles.action} ${user.status === "1" ? styles.actionWarning : styles.actionPrimary} ${disabled ? styles.actionDisabled : ""}`}
                  aria-label={user.status === "1" ? "禁用" : "启用"}
                  aria-disabled={disabled}
                  onClick={disabled ? undefined : handleToggleStatus}
                  hoverClass={styles.actionPressed}
                >
                  <DetailIcon
                    name={user.status === "1" ? "ban" : "check"}
                    color={user.status === "1" ? "#A86624" : "#1677FF"}
                  />
                  <Text>{user.status === "1" ? "禁用" : "启用"}</Text>
                </View>
              </>
            ) : null}
            {hasMore ? (
              <View
                className={`${styles.action} ${disabled ? styles.actionDisabled : ""}`}
                aria-label="更多操作"
                aria-disabled={disabled}
                onClick={disabled ? undefined : () => setMoreOpen(true)}
                hoverClass={styles.actionPressed}
              >
                <DetailIcon name="ellipsis" />
                <Text>更多操作</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
      {moreOpen && user && hasMore ? (
        <View className={styles.sheetLayer} catchMove>
          <View
            className={styles.sheetMask}
            onClick={() => setMoreOpen(false)}
            aria-label="关闭更多操作"
          />
          <View className={styles.sheet}>
            <View className={styles.sheet__header}>
              <Text className={styles.sheet__title}>更多操作</Text>
              <View
                className={styles.sheet__close}
                onClick={() => setMoreOpen(false)}
                aria-label="关闭操作面板"
              >
                <DetailIcon name="close" />
              </View>
            </View>
            {canUpdate ? (
              <View
                className={styles.sheet__item}
                aria-label="重置密码"
                onClick={() => handleResetPassword()}
                hoverClass={styles.actionPressed}
              >
                <DetailIcon name="keyRound" />
                <Text>重置密码</Text>
              </View>
            ) : null}
            {canDelete && user.id !== 1 ? (
              <View
                className={`${styles.sheet__item} ${styles.sheet__danger}`}
                aria-label="删除用户"
                onClick={handleDelete}
                hoverClass={styles.actionPressed}
              >
                <DetailIcon name="trash" color="#F53F3F" />
                <Text>删除用户</Text>
              </View>
            ) : null}
            <View
              className={styles.sheet__cancel}
              aria-label="取消"
              onClick={() => setMoreOpen(false)}
              hoverClass={styles.actionPressed}
            >
              <Text>取消</Text>
            </View>
          </View>
        </View>
      ) : null}
      {passwordOpen && user && canUpdate ? (
        <View className={styles.sheetLayer} catchMove>
          <View className={styles.sheetMask} />
          <View className={styles.passwordDialog}>
            <Text className={styles.sheet__title}>重置密码</Text>
            <Text className={styles.passwordDialog__hint}>
              为「{user.realName || user.username || user.phone}」设置新密码，6-50
              位，必须含字母和数字。
            </Text>
            <Input
              className={styles.passwordDialog__input}
              password
              value={password}
              placeholder="新密码"
              maxlength={50}
              disabled={submitting}
              onInput={(event) => setPassword(event.detail.value)}
            />
            {passwordError ? (
              <Text className={styles.passwordDialog__error}>{passwordError}</Text>
            ) : null}
            <View className={styles.passwordDialog__actions}>
              <View
                className={styles.action}
                aria-label="取消重置密码"
                onClick={
                  submitting
                    ? undefined
                    : () => {
                        setPasswordOpen(false);
                        setPassword("");
                      }
                }
              >
                <Text>取消</Text>
              </View>
              <View
                className={`${styles.action} ${styles.actionPrimary} ${submitting ? styles.actionDisabled : ""}`}
                aria-label="确认重置密码"
                onClick={submitting ? undefined : () => handleResetPassword(password)}
              >
                <Text>{submitting ? "提交中" : "确定"}</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
