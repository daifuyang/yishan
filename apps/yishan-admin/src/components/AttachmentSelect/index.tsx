import {
  CheckOutlined,
  CustomerServiceOutlined,
  EyeOutlined,
  FileOutlined,
  PictureOutlined,
  SearchOutlined,
  UploadOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { getAttachmentFolderTree, getAttachmentList } from "@/services/yishan-admin/attachments";
import { normalizeAttachmentStoredValue, resolveAttachmentPublicUrl } from "@/utils/attachmentUpload";
import { useModel } from "@umijs/max";
import { App, Button, Empty, Image, Input, List, Modal, Pagination, Segmented, Space, Spin, Tooltip, Tree, Upload, theme } from "antd";
import type { DataNode } from "antd/es/tree";
import type { UploadFile, UploadProps } from "antd";
import React, { useEffect, useMemo, useRef, useState } from "react";

type AttachmentKind = API.sysAttachment["kind"];
type KindTab = AttachmentKind | "all";
type ValueType = "url" | "id";

type AttachmentSelectValue = string | number | Array<string | number> | undefined;

export type AttachmentSelectProps = {
  value?: AttachmentSelectValue;
  onChange?: (value?: AttachmentSelectValue) => void;
  kind?: KindTab;
  multiple?: boolean;
  valueType?: ValueType;
  folderId?: number;
  maxCount?: number;
  disabled?: boolean;
};

const getKindFromFile = (file: File): AttachmentKind => {
  const mime = file.type || "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "other";
};

const getAcceptByKind = (kind?: KindTab) => {
  if (kind === "image") return "image/*";
  if (kind === "audio") return "audio/*";
  if (kind === "video") return "video/*";
  return undefined;
};

const toArray = (value?: AttachmentSelectValue) => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
};

type FolderItem = {
  id: number;
  name: string;
  parentIds: number[];
};

const flattenFolders = (nodes: API.sysAttachmentFolder[] = [], parentIds: number[] = []): FolderItem[] => {
  const list: FolderItem[] = [];
  for (const n of nodes) {
    list.push({ id: n.id, name: n.name, parentIds });
    if (Array.isArray(n.children) && n.children.length > 0) {
      list.push(...flattenFolders(n.children, [...parentIds, n.id]));
    }
  }
  return list;
};

const highlightText = (text: string, keyword: string) => {
  if (!keyword) return text;
  const lower = text.toLowerCase();
  const k = keyword.toLowerCase();
  const idx = lower.indexOf(k);
  if (idx < 0) return text;
  const before = text.slice(0, idx);
  const hit = text.slice(idx, idx + keyword.length);
  const after = text.slice(idx + keyword.length);
  return (
    <>
      {before}
      <span style={{ color: "#1677ff" }}>{hit}</span>
      {after}
    </>
  );
};

const mapTreeTitle = (nodes: API.sysAttachmentFolder[] = [], keyword: string): DataNode[] => {
  return nodes.map((n) => ({
    key: n.id,
    title: highlightText(n.name, keyword),
    children: Array.isArray(n.children) ? mapTreeTitle(n.children, keyword) : undefined,
  }));
};

const resolveAttachmentValue = (a: API.sysAttachment, valueType: ValueType) => {
  if (valueType === "id") return a.id;
  return a.objectKey || a.path || a.url || "";
};

const getAttachmentCover = (record: API.sysAttachment, publicUrl: string) => {
  const src = publicUrl;
  if (record.kind === "image" && src) {
    return (
      <Image
        src={src}
        preview={false}
      />
    );
  }
  const icon =
    record.kind === "audio" ? (
      <CustomerServiceOutlined />
    ) : record.kind === "video" ? (
      <VideoCameraOutlined />
    ) : (
      <FileOutlined />
    );
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.02)",
        fontSize: 44,
        color: "rgba(0,0,0,0.45)",
      }}
    >
      {icon}
    </div>
  );
};

type LibraryModalProps = {
  open: boolean;
  onCancel: () => void;
  onSelect: (items: API.sysAttachment[]) => void;
  kind?: KindTab;
  multiple?: boolean;
  valueType: ValueType;
  initialFolderId?: number;
  initialSelectedValues: Array<string | number>;
};

const AttachmentLibraryModal: React.FC<LibraryModalProps> = ({
  open,
  onCancel,
  onSelect,
  kind,
  multiple: _multiple,
  valueType,
  initialFolderId,
  initialSelectedValues,
}) => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { initialState } = useModel("@@initialState");
  const [folderTree, setFolderTree] = useState<API.sysAttachmentFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number>(initialFolderId || 0);

  const [tab, setTab] = useState<KindTab>(kind && kind !== "all" ? kind : "all");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<API.sysAttachment[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(() => initialSelectedValues.map((x) => String(x)));
  const [selectedMap, setSelectedMap] = useState<Record<string, API.sysAttachment>>({});
  const fixedKind = !!(kind && kind !== "all");
  const [folderSearchValue, setFolderSearchValue] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState(true);
  const [reloadSeq, setReloadSeq] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState("");
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const [gridContainerWidth, setGridContainerWidth] = useState(0);
  const gridColumns = useMemo(() => {
    const w = gridContainerWidth || 0;
    if (w < 576) return 4;
    if (w < 768) return 5;
    if (w < 992) return 6;
    if (w < 1200) return 6;
    if (w < 1600) return 8;
    return 8;
  }, [gridContainerWidth]);

  useEffect(() => {
    if (!open) return;
    const refresh = async () => {
      const res = await getAttachmentFolderTree();
      setFolderTree(res.data || []);
    };
    refresh();
  }, [open]);

  const folderItems = useMemo(() => flattenFolders(folderTree), [folderTree]);

  useEffect(() => {
    if (!open) return;
    if (!folderItems.length) return;
    if (folderSearchValue) return;
    setExpandedKeys([0, ...folderItems.map((f) => f.id)]);
    setAutoExpandParent(true);
  }, [open, folderItems, folderSearchValue]);

  useEffect(() => {
    if (!open) return;
    const keyword = folderSearchValue.trim();
    if (!keyword) return;
    const keys = new Set<React.Key>([0]);
    for (const item of folderItems) {
      if (item.name.toLowerCase().includes(keyword.toLowerCase())) {
        for (const id of item.parentIds) keys.add(id);
        keys.add(item.id);
      }
    }
    setExpandedKeys(Array.from(keys));
    setAutoExpandParent(true);
  }, [open, folderItems, folderSearchValue]);

  useEffect(() => {
    if (!open) return;
    const fetchList = async () => {
      setLoading(true);
      try {
        const res = await getAttachmentList({
          page,
          pageSize,
          keyword: keyword.trim() || undefined,
          folderId: selectedFolderId > 0 ? selectedFolderId : undefined,
          kind: fixedKind ? (kind as AttachmentKind) : tab === "all" ? undefined : (tab as AttachmentKind),
          status: "1",
        });
        setData(res.data || []);
        setTotal(res.pagination?.total || 0);
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, [open, page, pageSize, keyword, selectedFolderId, tab, fixedKind, kind, reloadSeq]);

  useEffect(() => {
    if (!open) return;
    if (!data.length) return;
    if (!selectedKeys.length) return;
    setSelectedMap((prev) => {
      const next = { ...prev };
      for (const item of data) {
        const k = String(resolveAttachmentValue(item, valueType));
        if (selectedKeys.includes(k) && !next[k]) next[k] = item;
      }
      return next;
    });
  }, [open, data, selectedKeys, valueType]);

  useEffect(() => {
    if (!open) return;
    setSelectedFolderId(initialFolderId || 0);
    setKeyword("");
    setPage(1);
    setTab(kind && kind !== "all" ? kind : "all");
    setSelectedKeys(initialSelectedValues.map((x) => String(x)));
    setSelectedMap({});
    setFolderSearchValue("");
    setReloadSeq(0);
  }, [open, initialFolderId, initialSelectedValues, kind]);

  const update = () => {
    const el = gridContainerRef.current;
    if (!el) return;
    const width = el.clientWidth || el.getBoundingClientRect().width || 0;
    setGridContainerWidth(width);
  };

  useEffect(() => {
    if (!open) return;
    const RO = (window as any).ResizeObserver as typeof ResizeObserver | undefined;
    if (RO) {
      const el = gridContainerRef.current;
      if (!el) return;
      const ro = new RO(() => update());
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [open]);

  const treeData = useMemo(() => {
    const rootTitle = highlightText("全部素材", folderSearchValue.trim());
    return [{ key: 0, title: rootTitle, children: mapTreeTitle(folderTree, folderSearchValue.trim()) }];
  }, [folderTree, folderSearchValue]);

  const uploadProps: UploadProps = useMemo(
    () => ({
      multiple: true,
      showUploadList: false,
      customRequest: async (options: any) => {
        const { file, onSuccess, onError } = options;
        try {
          const f: File = file as File;
          const uploadKind: AttachmentKind = fixedKind
            ? (kind as AttachmentKind)
            : tab !== "all"
              ? (tab as AttachmentKind)
              : getKindFromFile(f);

          const upload = initialState?.uploadAttachmentFile;
          if (!upload) {
            onError?.(new Error("上传能力未初始化"));
            return;
          }
          const res = await upload(f, {
            folderId: selectedFolderId > 0 ? selectedFolderId : undefined,
            kind: uploadKind,
            dir: "attachments",
          });

          if (res.success) {
            message.success(res.message || "上传成功");
            setPage(1);
            setReloadSeq((x) => x + 1);
            onSuccess?.(res, file as any);
            return;
          }
          onError?.(new Error(res.message || "上传失败"));
        } catch (e: any) {
          if (e instanceof Error) message.error(e.message);
          onError?.(e);
        }
      },
    }),
    [fixedKind, kind, message, selectedFolderId, tab]
  );

  return (
    <Modal
      title="选择素材"
      open={open}
      centered
      forceRender
      styles={{ body: { height: "76vh", padding: 0, overflow: "hidden" } }}
      destroyOnHidden
      onCancel={onCancel}
      onOk={() => {
        const picked = selectedKeys.map((k) => selectedMap[k]).filter(Boolean) as API.sysAttachment[];
        if (picked.length === 0) {
          message.warning("请先选择素材");
          return;
        }
        onSelect(picked);
      }}
      okText={`确定 ${selectedKeys.length ? `(${selectedKeys.length})` : ""}`}
      cancelText="取消"
      width='80%'
      style={{ maxWidth: "95vw", top: 20 }}
    >
      <div style={{ display: "flex", height: "100%", background: token.colorBgLayout }}>
        {/* Left Sidebar */}
        <div
          style={{
            width: 260,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            borderRight: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
          }}
        >
          <div style={{ padding: "16px 16px 8px" }}>
            <Input
              prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />}
              placeholder="搜索分组"
              value={folderSearchValue}
              onChange={(e) => setFolderSearchValue(e.target.value)}
              variant="filled"
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 16px" }}>
            <Tree
              blockNode
              showLine={{ showLeafIcon: false }}
              selectedKeys={[selectedFolderId]}
              expandedKeys={expandedKeys}
              autoExpandParent={autoExpandParent}
              treeData={treeData}
              onExpand={(keys) => {
                setExpandedKeys(keys);
                setAutoExpandParent(false);
              }}
              onSelect={(keys) => {
                const id = Number(keys?.[0] || 0);
                setSelectedFolderId(Number.isFinite(id) ? id : 0);
                setPage(1);
              }}
              style={{ background: "transparent" }}
            />
          </div>
        </div>

        {/* Right Content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: token.colorBgContainer }}>
          {/* Header */}
          <div
            style={{
              padding: "16px 24px",
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1 }}>
              {!fixedKind && (
                <Segmented
                  value={tab}
                  onChange={(v) => {
                    setTab(v as KindTab);
                    setPage(1);
                  }}
                  options={[
                    { label: "全部", value: "all", icon: <FileOutlined /> },
                    { label: "图片", value: "image", icon: <PictureOutlined /> },
                    { label: "音频", value: "audio", icon: <CustomerServiceOutlined /> },
                    { label: "视频", value: "video", icon: <VideoCameraOutlined /> },
                  ]}
                />
              )}
              <Input.Search
                placeholder="搜索素材"
                allowClear
                onSearch={() => setPage(1)}
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setPage(1);
                }}
                style={{ width: 240 }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {selectedKeys.length > 0 && (
                <Button
                  type="link"
                  danger
                  onClick={() => {
                    setSelectedKeys([]);
                    setSelectedMap({});
                  }}
                >
                  清空已选
                </Button>
              )}
              <Upload {...uploadProps}>
                <Button type="primary" icon={<UploadOutlined />}>
                  上传素材
                </Button>
              </Upload>
            </div>
          </div>

          {/* List Content */}
          <div ref={gridContainerRef} style={{ flex: 1, overflowY: "auto", padding: "16px 24px", position: "relative" }}>
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
                <Spin size="large" />
              </div>
            ) : data.length === 0 ? (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无素材" />
              </div>
            ) : (
              <List
                grid={{ gutter: 16, column: gridColumns }}
                dataSource={data}
                renderItem={(item) => {
                  const v = resolveAttachmentValue(item, valueType);
                  const k = String(v);
                  const checked = selectedKeys.includes(k);
                  const publicUrl = resolveAttachmentPublicUrl(item, initialState?.cloudStorageConfig);
                  return (
                    <List.Item style={{ marginBottom: 16 }}>
                      <div
                        className="attachment-card"
                        onClick={() => {
                          setSelectedKeys((prev) => {
                            if (prev.includes(k)) return prev.filter((x) => x !== k);
                            return [...prev, k];
                          });
                          setSelectedMap((prev) => {
                            const next = { ...prev };
                            if (checked) delete next[k];
                            else next[k] = item;
                            return next;
                          });
                        }}
                        style={{
                          position: "relative",
                          border: `1px solid ${checked ? token.colorPrimary : token.colorBorderSecondary}`,
                          borderRadius: token.borderRadiusLG,
                          overflow: "hidden",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          background: checked ? token.colorPrimaryBg : token.colorBgContainer,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = token.boxShadowSecondary;
                          e.currentTarget.style.borderColor = checked ? token.colorPrimary : token.colorPrimaryHover;
                          const previewBtn = e.currentTarget.querySelector(".preview-btn") as HTMLElement;
                          if (previewBtn) previewBtn.style.opacity = "1";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = "none";
                          e.currentTarget.style.borderColor = checked ? token.colorPrimary : token.colorBorderSecondary;
                          const previewBtn = e.currentTarget.querySelector(".preview-btn") as HTMLElement;
                          if (previewBtn) previewBtn.style.opacity = "0";
                        }}
                      >
                        {/* Selection Indicator */}
                        {checked && (
                          <div
                            style={{
                              position: "absolute",
                              top: 0,
                              right: 0,
                              zIndex: 10,
                              width: 0,
                              height: 0,
                              borderStyle: "solid",
                              borderWidth: "0 28px 28px 0",
                              borderColor: `transparent ${token.colorPrimary} transparent transparent`,
                            }}
                          >
                            <CheckOutlined
                              style={{
                                position: "absolute",
                                top: 4,
                                right: -26,
                                color: "#fff",
                                fontSize: 12,
                              }}
                            />
                          </div>
                        )}

                        <div style={{ position: "relative", aspectRatio: "1 / 1", background: token.colorFillQuaternary }}>
                          {getAttachmentCover(item, publicUrl)}
                          {item.kind === "image" && publicUrl && (
                            <div
                              className="preview-btn"
                              style={{
                                position: "absolute",
                                inset: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "rgba(0,0,0,0.3)",
                                opacity: 0,
                                transition: "opacity 0.2s",
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Tooltip title="预览大图">
                                <Button
                                  type="text"
                                  icon={<EyeOutlined style={{ fontSize: 18, color: "#fff" }} />}
                                  onClick={() => {
                                    setPreviewImage(publicUrl);
                                    setPreviewOpen(true);
                                  }}
                                  style={{ color: "#fff" }}
                                />
                              </Tooltip>
                            </div>
                          )}
                        </div>

                        <div style={{ padding: "8px 12px" }}>
                          <div
                            style={{
                              fontWeight: 500,
                              color: token.colorText,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: 13,
                            }}
                            title={item.name || item.originalName}
                          >
                            {item.name || item.originalName}
                          </div>
                          <div
                            style={{
                              color: token.colorTextSecondary,
                              fontSize: 12,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              marginTop: 2,
                            }}
                            title={item.originalName}
                          >
                            {item.originalName}
                          </div>
                        </div>
                      </div>
                    </List.Item>
                  );
                }}
              />
            )}
          </div>

          {/* Footer Pagination */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              background: token.colorBgContainer,
            }}
          >
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              onChange={(p: number, ps: number) => {
                setPage(p);
                setPageSize(ps);
              }}
              showTotal={(t: number) => `共 ${t} 项`}
            />
          </div>
        </div>
      </div>

      {previewImage && (
        <Image
          style={{ display: "none" }}
          preview={{
            visible: previewOpen,
            src: previewImage,
            onVisibleChange: (vis) => {
              setPreviewOpen(vis);
              if (!vis) setPreviewImage("");
            },
          }}
        />
      )}
    </Modal>
  );
};

export const AttachmentSelect: React.FC<AttachmentSelectProps> = ({
  value,
  onChange,
  kind = "all",
  multiple = false,
  valueType = "url",
  folderId,
  maxCount,
  disabled,
}) => {
  const { message } = App.useApp();
  const { initialState } = useModel("@@initialState");
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);

  const currentValues = useMemo(() => toArray(value), [value]);
  const modalSelectedValues = useMemo(() => {
    if (valueType !== "url") return currentValues;
    const cfg = initialState?.cloudStorageConfig;
    return currentValues
      .filter((v) => typeof v === "string" && v.trim().length > 0)
      .map((v) => normalizeAttachmentStoredValue(String(v), cfg));
  }, [currentValues, initialState?.cloudStorageConfig, valueType]);

  useEffect(() => {
    if (valueType === "url") {
      const cfg = initialState?.cloudStorageConfig;
      const list = currentValues
        .filter((v) => typeof v === "string" && v.trim().length > 0)
        .map((v, idx) => {
          const stored = String(v);
          const url = resolveAttachmentPublicUrl(stored, cfg);
          const name = stored.split("/").pop() || "file";
          return { uid: `attachment-${idx}`, name, status: "done", url } as UploadFile;
        });
      setFileList(list);
      return;
    }
    const list = currentValues.map((v, idx) => {
      const name = `ID:${String(v)}`;
      return { uid: `attachment-${idx}`, name, status: "done" } as UploadFile;
    });
    setFileList(list);
  }, [currentValues, initialState?.cloudStorageConfig, valueType]);

  const emitValues = (next: Array<string | number>) => {
    if (multiple) {
      onChange?.(next);
      return;
    }
    onChange?.(next.length ? next[0] : undefined);
  };

  const accept = getAcceptByKind(kind);
  const listType: UploadProps["listType"] = kind === "image" ? "picture-card" : "text";

  const handlePreview = async (file: UploadFile) => {
    const raw = String(file.url || (file.preview as string) || "");
    const src = resolveAttachmentPublicUrl(raw, initialState?.cloudStorageConfig);
    if (!src) return;
    setPreviewImage(src);
    setPreviewOpen(true);
  };

  const customRequest: UploadProps["customRequest"] = async (options: any) => {
    const { file, onSuccess, onError } = options;
    try {
      const f: File = file as File;
      const uploadKind: AttachmentKind =
        kind && kind !== "all" ? (kind as AttachmentKind) : getKindFromFile(f);

      const upload = initialState?.uploadAttachmentFile;
      if (!upload) {
        onError?.(new Error("上传能力未初始化"));
        return;
      }
      const res = await upload(f, {
        folderId,
        kind: uploadKind,
        dir: "attachments",
      });

      if (!res.success) {
        onError?.(new Error(res.message || "上传失败"));
        return;
      }
      const items = (res.data || []) as API.uploadAttachmentsResp["data"];
      const nextValues = items
        .map((x: API.uploadAttachmentsResp["data"][number]) => {
          if (valueType === "id") return x.id || 0;
          return x.path || x.url || "";
        })
        .filter((x: string | number) => (typeof x === "string" ? x.trim().length > 0 : Number(x) > 0));

      if (!nextValues.length) {
        message.error("上传成功但未返回可用地址");
        onSuccess?.(res, file as any);
        return;
      }

      const merged = multiple ? [...currentValues, ...nextValues] : [nextValues[0]];
      emitValues(merged as Array<string | number>);
      onSuccess?.(res, file as any);
    } catch (e: any) {
      if (e instanceof Error) message.error(e.message);
      onError?.(e);
    }
  };

  const uploadProps: UploadProps = {
    name: "file",
    listType,
    accept,
    fileList,
    customRequest,
    multiple,
    maxCount: multiple ? maxCount : 1,
    onPreview: kind === "image" ? handlePreview : undefined,
    onRemove: (file) => {
      if (!multiple) {
        emitValues([]);
        return true;
      }
      const idx = fileList.findIndex((f) => f.uid === file.uid);
      if (idx < 0) return true;
      const next = currentValues.filter((_, i) => i !== idx) as Array<string | number>;
      emitValues(next);
      return true;
    },
    disabled,
  };

  return (
    <>
      <Space direction="vertical" style={{ width: "100%" }}>
        <Space>
          <Upload {...uploadProps}>
            {kind === "image" ? (
              fileList.length >= (multiple ? maxCount || Infinity : 1) ? null : (
                <div style={{ border: 0, background: "none" }}>
                  <UploadOutlined />
                  <div style={{ marginTop: 8 }}>上传</div>
                </div>
              )
            ) : (
              <Button icon={<UploadOutlined />} disabled={disabled}>
                上传
              </Button>
            )}
          </Upload>
          <Button
            icon={kind === "image" ? <PictureOutlined /> : <FileOutlined />}
            onClick={() => setLibraryOpen(true)}
            disabled={disabled}
          >
            选择图片
          </Button>
        </Space>
      </Space>

      {previewImage && (
        <Image
          styles={{ root: { display: "none" } }}
          preview={{
            src: previewImage,
            open: previewOpen,
            onOpenChange: (open) => {
              setPreviewOpen(open);
              if (!open) setPreviewImage("");
            },
          }}
        />
      )}

      <AttachmentLibraryModal
        open={libraryOpen}
        onCancel={() => setLibraryOpen(false)}
        kind={kind}
        multiple={multiple}
        valueType={valueType}
        initialFolderId={folderId}
        initialSelectedValues={(modalSelectedValues as Array<string | number>) || []}
        onSelect={(items) => {
          const next = items
            .map((a) => resolveAttachmentValue(a, valueType))
            .filter((x) => (typeof x === "string" ? x.trim().length > 0 : Number(x) > 0));
          if (!next.length) {
            message.warning("未选择到可用素材");
            return;
          }
          const merged = multiple ? next : [next[0]];
          emitValues(merged as Array<string | number>);
          setLibraryOpen(false);
        }}
      />
    </>
  );
};

export const AttachmentSingleSelect: React.FC<Omit<AttachmentSelectProps, "multiple">> = (props) => {
  return <AttachmentSelect {...props} multiple={false} />;
};

export const AttachmentMultiSelect: React.FC<Omit<AttachmentSelectProps, "multiple">> = (props) => {
  return <AttachmentSelect {...props} multiple />;
};

export const AttachmentImageSelect: React.FC<Omit<AttachmentSelectProps, "kind">> = (props) => {
  return <AttachmentSelect {...props} kind="image" />;
};

export const AttachmentAudioSelect: React.FC<Omit<AttachmentSelectProps, "kind">> = (props) => {
  return <AttachmentSelect {...props} kind="audio" />;
};

export const AttachmentVideoSelect: React.FC<Omit<AttachmentSelectProps, "kind">> = (props) => {
  return <AttachmentSelect {...props} kind="video" />;
};

export const AttachmentFileSelect: React.FC<Omit<AttachmentSelectProps, "kind">> = (props) => {
  return <AttachmentSelect {...props} kind="other" />;
};
