import "./tiptap.scss";

import { TextStyleKit } from "@tiptap/extension-text-style";
import type { Editor } from "@tiptap/react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Tooltip } from "react-tooltip";
import React from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code2,
  Minus,
  Undo2,
  Redo2,
} from "lucide-react";
import { HeadingDropdownMenu } from "./tiptap-ui/heading-dropdown-menu";

const extensions = [TextStyleKit, StarterKit];

function MenuBar({ editor }: { editor: Editor }) {
  // Read the current editor's state, and re-render the component when it changes
  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      return {
        isBold: ctx.editor.isActive("bold") ?? false,
        canBold: ctx.editor.can().chain().toggleBold().run() ?? false,
        isItalic: ctx.editor.isActive("italic") ?? false,
        canItalic: ctx.editor.can().chain().toggleItalic().run() ?? false,
        isStrike: ctx.editor.isActive("strike") ?? false,
        canStrike: ctx.editor.can().chain().toggleStrike().run() ?? false,
        isCode: ctx.editor.isActive("code") ?? false,
        canCode: ctx.editor.can().chain().toggleCode().run() ?? false,
        canClearMarks: ctx.editor.can().chain().unsetAllMarks().run() ?? false,
        isParagraph: ctx.editor.isActive("paragraph") ?? false,
        isHeading1: ctx.editor.isActive("heading", { level: 1 }) ?? false,
        isHeading2: ctx.editor.isActive("heading", { level: 2 }) ?? false,
        isHeading3: ctx.editor.isActive("heading", { level: 3 }) ?? false,
        isHeading4: ctx.editor.isActive("heading", { level: 4 }) ?? false,
        isHeading5: ctx.editor.isActive("heading", { level: 5 }) ?? false,
        isHeading6: ctx.editor.isActive("heading", { level: 6 }) ?? false,
        isBulletList: ctx.editor.isActive("bulletList") ?? false,
        isOrderedList: ctx.editor.isActive("orderedList") ?? false,
        isCodeBlock: ctx.editor.isActive("codeBlock") ?? false,
        isBlockquote: ctx.editor.isActive("blockquote") ?? false,
        canUndo: ctx.editor.can().chain().undo().run() ?? false,
        canRedo: ctx.editor.can().chain().redo().run() ?? false,
      };
    },
  });

  // 当前选中的段落样式
  const currentParagraphStyle = editorState.isParagraph
    ? "正文"
    : editorState.isHeading1
    ? "标题1"
    : editorState.isHeading2
    ? "标题2"
    : editorState.isHeading3
    ? "标题3"
    : editorState.isHeading4
    ? "标题4"
    : editorState.isHeading5
    ? "标题5"
    : editorState.isHeading6
    ? "标题6"
    : "正文";

  return (
    <div className="yishan-editor-menu">
      {/* 第一组：操作控制 - 最常用功能 */}
      <div className="yishan-editor-menu-button-group">
        <button
          data-tooltip-id="editor-tooltip"
          data-tooltip-content="撤销"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editorState.canUndo}
          data-icon-only="true"
        >
          <Undo2 size={16} />
        </button>
        <button
          data-tooltip-id="editor-tooltip"
          data-tooltip-content="重做"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editorState.canRedo}
          data-icon-only="true"
        >
          <Redo2 size={16} />
        </button>
      </div>

      {/* 第二组：段落样式 - 使用select分组 */}
      <div className="yishan-editor-menu-select-group">
        <HeadingDropdownMenu
          editor={editor}
          levels={[1, 2, 3, 4, 5, 6]}
          hideWhenUnavailable={true}
          portal={false}
          onOpenChange={(isOpen) =>
            console.log("Dropdown", isOpen ? "opened" : "closed")
          }
        />
      </div>

      {/* 第三组：文本格式 - 核心格式功能 */}
      <div className="yishan-editor-menu-button-group">
        <button
          data-tooltip-id="editor-tooltip"
          data-tooltip-content="粗体"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editorState.canBold}
          className={editorState.isBold ? "is-active" : ""}
          data-icon-only="true"
        >
          <Bold size={16} />
        </button>
        <button
          data-tooltip-id="editor-tooltip"
          data-tooltip-content="斜体"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editorState.canItalic}
          className={editorState.isItalic ? "is-active" : ""}
          data-icon-only="true"
        >
          <Italic size={16} />
        </button>
        <button
          data-tooltip-id="editor-tooltip"
          data-tooltip-content="删除线"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editorState.canStrike}
          className={editorState.isStrike ? "is-active" : ""}
          data-icon-only="true"
        >
          <Strikethrough size={16} />
        </button>
        <button
          data-tooltip-id="editor-tooltip"
          data-tooltip-content="行内代码"
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={!editorState.canCode}
          className={editorState.isCode ? "is-active" : ""}
          data-icon-only="true"
        >
          <Code2 size={16} />
        </button>
      </div>

      {/* 第四组：列表和引用 - 结构化内容 */}
      <div className="yishan-editor-menu-button-group">
        <button
          data-tooltip-id="editor-tooltip"
          data-tooltip-content="无序列表"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editorState.isBulletList ? "is-active" : ""}
          data-icon-only="true"
        >
          <List size={16} />
        </button>
        <button
          data-tooltip-id="editor-tooltip"
          data-tooltip-content="有序列表"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editorState.isOrderedList ? "is-active" : ""}
          data-icon-only="true"
        >
          <ListOrdered size={16} />
        </button>
        <button
          data-tooltip-id="editor-tooltip"
          data-tooltip-content="引用"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editorState.isBlockquote ? "is-active" : ""}
          data-icon-only="true"
        >
          <Quote size={16} />
        </button>
      </div>

      {/* 第五组：代码块和分隔线 - 特殊格式 */}
      <div className="yishan-editor-menu-button-group">
        <button
          data-tooltip-id="editor-tooltip"
          data-tooltip-content="代码块"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editorState.isCodeBlock ? "is-active" : ""}
          data-icon-only="true"
        >
          <Code2 size={16} />
        </button>
        <button
          data-tooltip-id="editor-tooltip"
          data-tooltip-content="分隔线"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          data-icon-only="true"
        >
          <Minus size={16} />
        </button>
      </div>
    </div>
  );
}

export const TiptapEditor = () => {
  const editor = useEditor({
    extensions,
    editorProps: {
      attributes: {
        class: "yishan-editor-content", // 只在容器上打标记
      },
    },
    content: `
<h1>
  Tiptap 中文编辑器演示
</h1>
<p>
  这是一个<strong>功能强大</strong>的富文本编辑器，支持<em>斜体文本</em>和<del>删除线</del>等多种文本格式。让我们来看看各种排版效果：
</p>

<h2>
  标题样式展示
</h2>
<p>
  上面的标题使用了 H1 样式，居中显示。下面是 H2 标题，带有底部边框装饰。
</p>

<h3>
  列表格式演示
</h3>
<p>
  无序列表示例：
</p>
<ul>
  <li>
    第一项内容，展示基本的列表项格式
  </li>
  <li>
    第二项内容，可以包含<strong>粗体文本</strong>
    <ul>
      <li>嵌套的无序列表项</li>
      <li>支持多级嵌套结构</li>
    </ul>
  </li>
</ul>

<p>
  有序列表示例：
</p>
<ol>
  <li>
    第一步操作指南
  </li>
  <li>
    第二步详细说明
    <ol>
      <li>子步骤一：具体执行方法</li>
      <li>子步骤二：注意事项说明</li>
    </ol>
  </li>
  <li>
    第三步总结要点
  </li>
</ol>

<h4>
  代码块展示
</h4>
<p>
  下面是一个 CSS 代码示例，展示了代码块的样式效果：
</p>
<pre><code class="language-css">/* 中文注释：响应式布局样式 */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem;
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
}

@media (max-width: 768px) {
  .container {
    padding: 1rem;
  }
}</code></pre>

<h5>
  引用文本演示
</h5>
<blockquote>
  <p>
    "良好的代码注释是程序员之间沟通的桥梁，清晰的文档能够大大提高团队协作效率。"
  </p>
  <p>
    —— 资深开发工程师
  </p>
</blockquote>

<h6>
  其他格式展示
</h6>
<p>
  行内代码示例：使用 <code>console.log()</code> 来调试 JavaScript 程序。
</p>

<p>
  中文数字格式：<span class="chinese-number">2024年3月15日</span>，版本号：<span class="chinese-number">v2.1.0</span>
</p>

<p>
  标点符号优化示例：这是一段中文文本，展示了中文排版中的标点符号处理效果。注意引号"和"的使用，以及括号（）的间距。
</p>

<hr>

<p>
  以上是 Tiptap 编辑器支持的主要格式演示。您可以尝试编辑这些内容，体验强大的富文本编辑功能。支持撤销/重做操作，以及各种快捷键操作。
</p>

<p style="text-align: center; margin-top: 2rem;">
  <small>💡 提示：点击工具栏按钮或选中文字进行格式设置</small>
</p>
`,
    immediatelyRender: false,
  });

  if (!editor) {
    return null; // Prevent rendering until the editor is initialized
  }

  return (
    <div className="yishan-editor-root">
      <MenuBar editor={editor} />
      <EditorContent editor={editor} />
      <Tooltip id="editor-tooltip" className="yishan-editor-tooltip" />
    </div>
  );
};
