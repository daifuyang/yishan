import React, { createContext, useContext } from 'react';
import type { CurrentUser, AttachmentKind, UploadAttachmentsResp } from './types';
import type { CloudStorageConfig } from './utils/attachmentUpload';

export interface SystemAdminRuntime {
  currentUser?: CurrentUser;
  navigate?: (path: string) => void;
  dictDataMap?: Record<string, { label: string; value: string }[]>;
  cloudStorageConfig?: CloudStorageConfig;
  uploadAttachmentFile?: (
    file: File,
    params: { folderId?: number; kind?: AttachmentKind; name?: string; dir?: string },
  ) => Promise<UploadAttachmentsResp>;
}

const SystemAdminContext = createContext<SystemAdminRuntime | undefined>(undefined);

export function SystemAdminProvider({
  value,
  children,
}: React.PropsWithChildren<{ value: SystemAdminRuntime }>) {
  return <SystemAdminContext.Provider value={value}>{children}</SystemAdminContext.Provider>;
}

export function useSystemAdmin(): { initialState: SystemAdminRuntime } {
  const runtime = useContext(SystemAdminContext);
  if (!runtime) {
    throw new Error('System components require SystemAdminProvider.');
  }
  return { initialState: runtime };
}
