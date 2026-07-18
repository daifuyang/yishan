"use client";

import * as React from "react";
import { EditorContent, EditorContext, useEditor } from "@tiptap/react";
import { Expand, Maximize2, Minimize2, Shrink } from "lucide-react";

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TextAlign } from "@tiptap/extension-text-align";
import { Typography } from "@tiptap/extension-typography";
import { Highlight } from "@tiptap/extension-highlight";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { Selection } from "@tiptap/extensions";
import { TextStyle, Color } from "@tiptap/extension-text-style";

// --- UI Primitives ---
import { Button } from "@/components/tiptap-ui-primitive/button";
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/tiptap-ui-primitive/toolbar";

// --- Tiptap Node ---
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension";
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension";
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss";
import "@/components/tiptap-node/code-block-node/code-block-node.scss";
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss";
import "@/components/tiptap-node/list-node/list-node.scss";
import "@/components/tiptap-node/image-node/image-node.scss";
import "@/components/tiptap-node/heading-node/heading-node.scss";
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss";

// --- Tiptap UI ---
import { HeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu";
import { ImageUploadButton } from "@/components/tiptap-ui/image-upload-button";
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu";
import { BlockquoteButton } from "@/components/tiptap-ui/blockquote-button";
import { CodeBlockButton } from "@/components/tiptap-ui/code-block-button";
import {
  ColorHighlightPopover,
  ColorHighlightPopoverContent,
  ColorHighlightPopoverButton,
} from "@/components/tiptap-ui/color-highlight-popover";
import {
  LinkPopover,
  LinkContent,
  LinkButton,
} from "@/components/tiptap-ui/link-popover";
import { MarkButton } from "@/components/tiptap-ui/mark-button";
import { TextAlignButton } from "@/components/tiptap-ui/text-align-button";
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button";

// --- Icons ---
import { ArrowLeftIcon } from "@/components/tiptap-icons/arrow-left-icon";
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon";
import { LinkIcon } from "@/components/tiptap-icons/link-icon";

// --- Hooks ---
import { useIsMobile } from "@/hooks/use-mobile";
import { useWindowSize } from "@/hooks/use-window-size";
import { useCursorVisibility } from "@/hooks/use-cursor-visibility";
import { TiptapLocaleProvider, type TiptapLocale, useTiptapLocale } from "../../../i18n";


// --- Lib ---
import { handleImageUpload, MAX_FILE_SIZE } from "@/lib/tiptap-utils";

// --- Styles ---
import "@/components/tiptap-templates/simple/form-editor.scss";

const SendIcon = React.memo(
  ({ className }: React.SVGProps<SVGSVGElement>) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m21 3-7.5 18-3.5-8-7-3L21 3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="m10.5 13 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
)

const ExpandIcon = Maximize2 as unknown as React.ComponentType<React.SVGProps<SVGSVGElement>>
const CollapseIcon = Minimize2 as unknown as React.ComponentType<React.SVGProps<SVGSVGElement>>
const FullscreenExpandIcon = Expand as unknown as React.ComponentType<React.SVGProps<SVGSVGElement>>
const FullscreenShrinkIcon = Shrink as unknown as React.ComponentType<React.SVGProps<SVGSVGElement>>

const MainToolbarContent = ({
  onHighlighterClick,
  onLinkClick,
  isMobile,
  isFullscreen,
  onFullscreenToggle,
  onPickImage,
  compactToolbar,
  chatToolbar,
  showFullscreenToggle,
  showImageUpload,
}: {
  onHighlighterClick: () => void;
  onLinkClick: () => void;
  isMobile: boolean;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
  onPickImage?: () => Promise<ImageInsertItem[]>;
  chatToolbar: boolean;
  compactToolbar: boolean;
  showFullscreenToggle: boolean;
  showImageUpload: boolean;
}) => {
  const locale = useTiptapLocale();

  if (compactToolbar) {
    return (
      <div className="form-editor-toolbar">
        <ToolbarGroup>
          <UndoRedoButton action="undo" />
          <UndoRedoButton action="redo" />
        </ToolbarGroup>
        <ToolbarSeparator className="toolbar-separator" />
        <ToolbarGroup>
          <MarkButton type="bold" />
          <MarkButton type="italic" />
          <MarkButton type="strike" />
          <MarkButton type="underline" />
          <LinkPopover />
        </ToolbarGroup>
      </div>
    );
  }

  if (chatToolbar) {
    return (
      <div className="form-editor-toolbar">
        <ToolbarGroup>
          <UndoRedoButton action="undo" />
          <UndoRedoButton action="redo" />
        </ToolbarGroup>
        <ToolbarSeparator className="toolbar-separator" />
        <ToolbarGroup>
          <MarkButton type="bold" />
          <MarkButton type="italic" />
          <MarkButton type="underline" />
          <MarkButton type="strike" />
          <ListDropdownMenu
            types={["bulletList", "orderedList"]}
            portal={isMobile}
          />
          <LinkPopover />
        </ToolbarGroup>
        {showFullscreenToggle ? (
          <>
            <ToolbarSeparator className="toolbar-separator" />
            <ToolbarGroup>
              <Button data-style="ghost" onClick={onFullscreenToggle} aria-label={locale.toggleFullscreen}>
                {isFullscreen ? (
                  <FullscreenShrinkIcon className="tiptap-button-icon" />
                ) : (
                  <FullscreenExpandIcon className="tiptap-button-icon" />
                )}
              </Button>
            </ToolbarGroup>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="form-editor-toolbar">
      <ToolbarGroup>
        <UndoRedoButton action="undo" />
        <UndoRedoButton action="redo" />
      </ToolbarGroup>

      <ToolbarSeparator className="toolbar-separator" />

      <ToolbarGroup>
        <HeadingDropdownMenu levels={[1, 2, 3, 4]} portal={isMobile} />
        <ListDropdownMenu
          types={["bulletList", "orderedList", "taskList"]}
          portal={isMobile}
        />
        <BlockquoteButton />
        <CodeBlockButton />
      </ToolbarGroup>

      <ToolbarSeparator className="toolbar-separator" />

      <ToolbarGroup>
        <MarkButton type="bold" />
        <MarkButton type="italic" />
        <MarkButton type="strike" />
        <MarkButton type="code" />
        <MarkButton type="underline" />
        {!isMobile ? (
          <ColorHighlightPopover />
        ) : (
          <ColorHighlightPopoverButton onClick={onHighlighterClick} />
        )}
        {!isMobile ? <LinkPopover /> : <LinkButton onClick={onLinkClick} />}
      </ToolbarGroup>

      <ToolbarSeparator className="toolbar-separator" />

      <ToolbarGroup>
        <MarkButton type="superscript" />
        <MarkButton type="subscript" />
      </ToolbarGroup>

      <ToolbarSeparator className="toolbar-separator" />

      <ToolbarGroup>
        <TextAlignButton align="left" />
        <TextAlignButton align="center" />
        <TextAlignButton align="right" />
        <TextAlignButton align="justify" />
      </ToolbarGroup>

      {showImageUpload ? (
        <>
          <ToolbarSeparator className="toolbar-separator" />

          <ToolbarGroup>
            <ImageUploadButton text="" onPick={onPickImage} />
          </ToolbarGroup>
        </>
      ) : null}

      {showFullscreenToggle ? (
        <>
          <ToolbarSeparator className="toolbar-separator" />

          <ToolbarGroup>
            <Button data-style="ghost" onClick={onFullscreenToggle} aria-label={locale.toggleFullscreen}>
              {isFullscreen ? (
                <FullscreenShrinkIcon className="tiptap-button-icon" />
              ) : (
                <FullscreenExpandIcon className="tiptap-button-icon" />
              )}
            </Button>
          </ToolbarGroup>
        </>
      ) : null}

      {isMobile && <ToolbarSeparator />}
    </div>
  );
};

const MobileToolbarContent = ({
  type,
  onBack,
}: {
  type: "highlighter" | "link";
  onBack: () => void;
}) => (
  <>
    <ToolbarGroup>
      <Button data-style="ghost" onClick={onBack}>
        <ArrowLeftIcon className="tiptap-button-icon" />
        {type === "highlighter" ? (
          <HighlighterIcon className="tiptap-button-icon" />
        ) : (
          <LinkIcon className="tiptap-button-icon" />
        )}
      </Button>
    </ToolbarGroup>

    <ToolbarSeparator />

    {type === "highlighter" ? (
      <ColorHighlightPopoverContent />
    ) : (
      <LinkContent />
    )}
  </>
);

export interface FormEditorProps {
  value?: string | object
  maxHeight?: number
  minHeight?: number
  footer?: React.ReactNode | ((controls: { isFullscreen: boolean; toggleFullscreen: () => void }) => React.ReactNode)
  chatToolbar?: boolean
  integratedFooter?: boolean
  onChange?: (value: string) => void
  imageUploadAdapter?: ImageUploadAdapter
  compactToolbar?: boolean
  showFullscreenToggle?: boolean
  showToolbar?: boolean
  toolbarFloating?: boolean
  showImageUpload?: boolean
  /**
   * Chat composer interaction. When provided, the editor starts as a compact
   * single-line composer and expands into the standard rich-text toolbar.
   */
  composer?: {
    disabled?: boolean
    onSend: () => void
  }
  locale?: Partial<TiptapLocale>
}

export type ImageInsertItem = {
  src: string
  alt?: string
  title?: string
}

export type UploadFunction = (
  file: File,
  onProgress?: (event: { progress: number }) => void,
  abortSignal?: AbortSignal
) => Promise<string>

export type ImageUploadAdapter = {
  upload?: UploadFunction
  pick?: (options?: { multiple?: boolean; limit?: number }) => Promise<ImageInsertItem[]>
}

const FormEditorContent: React.FC<Omit<FormEditorProps, 'locale'>> = (props) => {
  const {
    maxHeight = 400,
    minHeight = 150,
    footer,
    chatToolbar = false,
    integratedFooter = false,
    value,
    onChange,
    imageUploadAdapter,
    compactToolbar = false,
    showImageUpload = true,
    showFullscreenToggle = true,
    showToolbar = true,
    toolbarFloating = false,
    composer,
  } = props;
  const locale = useTiptapLocale();
  const isMobile = useIsMobile();
  const { height } = useWindowSize();
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [isComposerExpanded, setIsComposerExpanded] = React.useState(false);
  const [mobileView, setMobileView] = React.useState<
    "main" | "highlighter" | "link"
  >("main");
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const onSendRef = React.useRef(composer?.onSend)
  const imageUploadLimit = 3
  const isComposer = Boolean(composer)
  const isToolbarVisible = isComposer ? isComposerExpanded : showToolbar
  const isToolbarFloating = isComposer ? false : toolbarFloating
  const toggleFullscreen = () => {
    setIsComposerExpanded(true)
    setIsFullscreen((current) => !current)
  }

  React.useEffect(() => {
    onSendRef.current = composer?.onSend
  }, [composer?.onSend])

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": locale.editorAriaLabel,
        class: "form-editor",
      },
      handleKeyDown: (_view, event) => {
        if (
          isComposer &&
          !composer?.disabled &&
          event.key === "Enter" &&
          (event.ctrlKey || event.metaKey)
        ) {
          event.preventDefault()
          onSendRef.current?.()
          return true
        }
        return false
      },
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
      }),
      HorizontalRule,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Image,
      Typography,
      Superscript,
      Subscript,
      Selection,
      TextStyle,
      Color,
      ImageUploadNode.configure({
        accept: "image/*",
        maxSize: MAX_FILE_SIZE,
        limit: imageUploadLimit,
        upload: imageUploadAdapter?.upload ?? handleImageUpload,
        onError: (error) => console.error("Upload failed:", error),
      }),
    ],
    onUpdate: ({ editor }) => { onChange?.(editor.getHTML()); },
    content: value,
  });

  const rect = useCursorVisibility({
    editor,
    overlayHeight: toolbarRef.current?.getBoundingClientRect().height ?? 0,
  });

  React.useEffect(() => {
    if (!isMobile && mobileView !== "main") {
      setMobileView("main");
    }
  }, [isMobile, mobileView]);

  React.useEffect(() => {
    editor?.setEditable(!composer?.disabled)
  }, [composer?.disabled, editor])

  React.useEffect(() => {
    if (typeof value !== "string" || !editor || value === editor.getHTML()) return
    editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, value])

  const collapseComposer = () => {
    setIsFullscreen(false)
    setIsComposerExpanded(false)
  }

  return (
    <div className={isComposer ? "form-editor-composer-host" : undefined}>
      <div className={`form-editor-wrapper${isFullscreen ? " fullscreen" : ""}${integratedFooter ? " integrated-footer" : ""}${isToolbarFloating ? " floating-toolbar" : ""}${isComposer ? " chat-composer" : ""}${isComposerExpanded ? " chat-composer-expanded" : ""}`}>
      <EditorContext.Provider value={{ editor }}>
        {isComposer ? (
          <div className="form-editor-composer-actions">
            {showImageUpload ? (
              <ImageUploadButton
                text=""
                disabled={composer?.disabled}
                onPick={
                  imageUploadAdapter?.pick
                    ? () => imageUploadAdapter.pick?.({ multiple: true, limit: imageUploadLimit }) ?? Promise.resolve([])
                    : undefined
                }
              />
            ) : null}
            <Button
              type="button"
              data-style="ghost"
              disabled={composer?.disabled}
              tooltip={isComposerExpanded ? "缩小" : "放大"}
              aria-label={isComposerExpanded ? "缩小" : "放大"}
              onClick={isComposerExpanded ? collapseComposer : () => setIsComposerExpanded(true)}
            >
              {isComposerExpanded ? (
                <CollapseIcon className="tiptap-button-icon" />
              ) : (
                <ExpandIcon className="tiptap-button-icon" />
              )}
            </Button>
            <Button
              type="button"
              data-style="ghost"
              disabled={composer?.disabled}
              tooltip="发送（Ctrl/⌘ + Enter）"
              aria-label="发送"
              onClick={composer?.onSend}
            >
              <SendIcon className="tiptap-button-icon" />
            </Button>
          </div>
        ) : null}
        {isToolbarVisible ? (
          <Toolbar
            ref={toolbarRef}
            style={{
              ...(isMobile
                ? {
                  bottom: `calc(100% - ${height - rect.y}px)`,
                }
                : {}),
            }}
          >
            {mobileView === "main" ? (
              <MainToolbarContent
                onHighlighterClick={() => setMobileView("highlighter")}
                onLinkClick={() => setMobileView("link")}
                isMobile={isMobile}
                isFullscreen={isFullscreen}
                onFullscreenToggle={toggleFullscreen}
                chatToolbar={isComposer || chatToolbar}
                compactToolbar={compactToolbar}
                showFullscreenToggle={showFullscreenToggle}
                showImageUpload={showImageUpload}
                onPickImage={
                  showImageUpload && imageUploadAdapter?.pick
                    ? () => imageUploadAdapter.pick?.({ multiple: true, limit: imageUploadLimit }) ?? Promise.resolve([])
                    : undefined
                }
              />
            ) : (
              <MobileToolbarContent
                type={mobileView === "highlighter" ? "highlighter" : "link"}
                onBack={() => setMobileView("main")}
              />
            )}
          </Toolbar>
        ) : null}

        <EditorContent
          editor={editor}
          style={
            isFullscreen
              ? {}
              : ({
                maxHeight: isComposer ? (isComposerExpanded ? 302 : 106) : maxHeight,
                '--form-editor-min-height': `${isComposer ? (isComposerExpanded ? 154 : 22) : minHeight}px`,
              } as React.CSSProperties)
          }
          role="presentation"
          className="form-editor-content"
        />
        {footer ? (
          <div className="form-editor-footer">
            {typeof footer === 'function'
              ? footer({ isFullscreen, toggleFullscreen })
              : footer}
          </div>
        ) : null}
      </EditorContext.Provider>
      </div>
    </div>
  );
}

export function FormEditor({ locale, ...props }: FormEditorProps) {
  return (
    <TiptapLocaleProvider locale={locale}>
      <FormEditorContent {...props} />
    </TiptapLocaleProvider>
  )
}
