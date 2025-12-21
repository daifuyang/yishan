import React, { useEffect, useMemo, useState } from "react";
import type { UploadFile, UploadProps } from "antd";
import { App, Button, Checkbox, Image, Input, List, Modal, Space, Tabs, Tree, Upload } from "antd";
import type { DataNode } from "antd/es/tree";
import { FileOutlined, PictureOutlined, UploadOutlined, VideoCameraOutlined, CustomerServiceOutlined } from "@ant-design/icons";
import { getAttachmentFolderTree, getAttachmentList, uploadAttachments } from "@/services/yishan-admin/attachments";

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
  return a.url || a.path || "";
};

const getAttachmentCover = (record: API.sysAttachment) => {
  const src = record.url || record.path;
  if (record.kind === "image" && src) {
    return (
      <Image
        src={src}
        preview={{ src }}
        style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }}
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
        height: 120,
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
  multiple,
  valueType,
  initialFolderId,
  initialSelectedValues,
}) => {
  const { message } = App.useApp();
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
          const formData = new FormData();
          formData.append("file", f);

          const uploadKind: AttachmentKind = fixedKind
            ? (kind as AttachmentKind)
            : tab !== "all"
              ? (tab as AttachmentKind)
              : getKindFromFile(f);

          const params: API.uploadAttachmentsParams = {
            folderId: selectedFolderId > 0 ? selectedFolderId : undefined,
            kind: uploadKind,
          };
          const res = await uploadAttachments(params, { data: formData });
          if (res.success) {
            message.success(res.message || "上传成功");
            setPage(1);
            setReloadSeq((x) => x + 1);
            onSuccess?.(res, file as any);
            return;
          }
          onError?.(new Error(res.message || "上传失败"));
        } catch (e: any) {
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
      width={980}
      destroyOnClose
      onCancel={onCancel}
      onOk={() => {
        if (!multiple) return;
        const picked = selectedKeys.map((k) => selectedMap[k]).filter(Boolean) as API.sysAttachment[];
        if (picked.length === 0) {
          message.warning("请先选择素材");
          return;
        }
        onSelect(picked);
      }}
      okButtonProps={{ disabled: !multiple }}
      okText="确定"
      cancelText="取消"
    >
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ width: 240 }}>
          <Input
            allowClear
            placeholder="搜索分组"
            value={folderSearchValue}
            onChange={(e) => setFolderSearchValue(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <Tree
            blockNode
            showLine
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
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Space style={{ width: "100%", justifyContent: "space-between" }} align="start">
            <Input.Search
              allowClear
              placeholder="搜索素材名称/原始文件名"
              style={{ width: 360 }}
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              onSearch={() => setPage(1)}
            />
            <Upload {...uploadProps}>
              <Button type="primary">
                <UploadOutlined /> 上传
              </Button>
            </Upload>
            <div>
              <Button
                type="link"
                onClick={() => {
                  setSelectedKeys([]);
                  setSelectedMap({});
                }}
                disabled={!selectedKeys.length}
              >
                清空选择
              </Button>
              <span style={{ color: "rgba(0,0,0,0.45)" }}>
                已选 {selectedKeys.length}
              </span>
            </div>
          </Space>

          <div style={{ marginTop: 12 }}>
            {fixedKind ? null : (
              <Tabs
                activeKey={tab}
                onChange={(k) => {
                  setTab(k as KindTab);
                  setPage(1);
                }}
                items={[
                  { key: "all", label: "全部" },
                  { key: "image", label: "图片" },
                  { key: "audio", label: "音频" },
                  { key: "video", label: "视频" },
                  { key: "other", label: "其他" },
                ]}
              />
            )}
            <List
              loading={loading}
              grid={{ gutter: 12, column: 4 }}
              dataSource={data}
              pagination={{
                current: page,
                pageSize,
                total,
                showSizeChanger: true,
                onChange: (p, ps) => {
                  setPage(p);
                  setPageSize(ps);
                },
              }}
              renderItem={(item) => {
                const v = resolveAttachmentValue(item, valueType);
                const k = String(v);
                const checked = selectedKeys.includes(k);
                return (
                  <List.Item>
                    <button
                      type="button"
                      onClick={() => {
                        if (multiple) {
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
                          return;
                        }
                        onSelect([item]);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: 0,
                        textAlign: "left",
                        background: "transparent",
                        border: checked ? "1px solid #1677ff" : "1px solid rgba(0,0,0,0.08)",
                        borderRadius: 8,
                        overflow: "hidden",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ position: "relative" }}>
                        {multiple && (
                          <div style={{ position: "absolute", top: 8, left: 8, zIndex: 1 }}>
                            <Checkbox
                              checked={checked}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const next = e.target.checked;
                                setSelectedKeys((prev) => {
                                  if (next) return prev.includes(k) ? prev : [...prev, k];
                                  return prev.filter((x) => x !== k);
                                });
                                setSelectedMap((prev) => {
                                  const mapNext = { ...prev };
                                  if (next) mapNext[k] = item;
                                  else delete mapNext[k];
                                  return mapNext;
                                });
                              }}
                            />
                          </div>
                        )}
                        {getAttachmentCover(item)}
                      </div>
                      <div style={{ padding: 10 }}>
                        <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.name || item.originalName}
                        </div>
                        <div style={{ color: "rgba(0,0,0,0.45)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.originalName}
                        </div>
                      </div>
                    </button>
                  </List.Item>
                );
              }}
            />
          </div>
        </div>
      </div>
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
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);

  const currentValues = useMemo(() => toArray(value), [value]);

  useEffect(() => {
    if (valueType === "url") {
      const list = currentValues
        .filter((v) => typeof v === "string" && v.trim().length > 0)
        .map((v, idx) => {
          const url = String(v);
          const name = url.split("/").pop() || "file";
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
  }, [currentValues, valueType]);

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
    const src = file.url || (file.preview as string) || "";
    if (!src) return;
    setPreviewImage(src);
    setPreviewOpen(true);
  };

  const customRequest: UploadProps["customRequest"] = async (options: any) => {
    const { file, onSuccess, onError } = options;
    try {
      const f: File = file as File;
      const formData = new FormData();
      formData.append("file", f);

      const uploadKind: AttachmentKind =
        kind && kind !== "all" ? (kind as AttachmentKind) : getKindFromFile(f);

      const res = await uploadAttachments(
        { folderId, kind: uploadKind },
        { data: formData }
      );

      if (!res.success) {
        onError?.(new Error(res.message || "上传失败"));
        return;
      }
      const items = res.data || [];
      const nextValues = items
        .map((x) => {
          if (valueType === "id") return x.id || 0;
          return x.url || x.path || "";
        })
        .filter((x) => (typeof x === "string" ? x.trim().length > 0 : Number(x) > 0));

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
        initialSelectedValues={currentValues as Array<string | number>}
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

