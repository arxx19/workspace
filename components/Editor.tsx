"use client";

import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight, common } from "lowlight";
import { useEffect, useRef, useState } from "react";
import { savePageContent } from "@/app/page-actions";
import type { Editor as TiptapEditor } from "@tiptap/react";

const lowlight = createLowlight(common);

type SaveState = "saved" | "saving" | "unsaved";

function Toolbar({ editor }: { editor: TiptapEditor | null }) {
  if (!editor) return null;
  const btn = (active: boolean) =>
    `rounded px-2 py-1 text-sm ${active ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800"}`;

  return (
    <div className="mb-2 flex flex-wrap gap-1 border-b border-gray-700 pb-2">
      <button
        className={btn(editor.isActive("heading", { level: 1 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        H1
      </button>
      <button
        className={btn(editor.isActive("heading", { level: 2 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </button>
      <button
        className={btn(editor.isActive("bold"))}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        Bold
      </button>
      <button
        className={btn(editor.isActive("italic"))}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        Italic
      </button>
      <button
        className={btn(editor.isActive("bulletList"))}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        • List
      </button>
      <button
        className={btn(editor.isActive("orderedList"))}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1. List
      </button>
      <button
        className={btn(editor.isActive("taskList"))}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        ☑ Checklist
      </button>
      <button
        className={btn(editor.isActive("codeBlock"))}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        Code
      </button>
      <button
        className={btn(editor.isActive("blockquote"))}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        Quote
      </button>
    </div>
  );
}

export default function Editor({
  orgId,
  pageId,
  initialContent,
  editable,
}: {
  orgId: string;
  pageId: string;
  initialContent: JSONContent;
  editable: boolean;
}) {
  const [status, setStatus] = useState<SaveState>("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content: initialContent,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      setStatus("unsaved");
      if (timer.current) clearTimeout(timer.current);
      // Wait 1.5s after the last keystroke, then save
      timer.current = setTimeout(async () => {
        setStatus("saving");
        try {
          await savePageContent(
            orgId,
            pageId,
            editor.getJSON(),
            editor.getText(),
          );
          setStatus("saved");
        } catch {
          setStatus("unsaved");
        }
      }, 1500);
    },
  });

  // Save immediately if the user navigates away with unsaved changes
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (editor && status !== "saved") {
        savePageContent(
          orgId,
          pageId,
          editor.getJSON(),
          editor.getText(),
        ).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return (
    <div>
      {editable && (
        <>
          <Toolbar editor={editor} />
          <p className="mb-2 text-xs text-gray-500">
            {status === "saving"
              ? "Saving…"
              : status === "unsaved"
                ? "Unsaved changes"
                : "Saved"}
          </p>
        </>
      )}
      <EditorContent
        editor={editor}
        className="prose prose-invert min-h-[200px] max-w-none rounded border border-gray-700 p-4 [&_.ProseMirror]:outline-none [&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0"
      />
    </div>
  );
}
