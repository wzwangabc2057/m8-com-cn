'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  Strikethrough,
  Code,
  List, 
  ListOrdered, 
  Heading1, 
  Heading2, 
  Quote, 
  Image as ImageIcon,
  Undo,
  Redo,
  Minus
} from 'lucide-react';
import { useEffect, useRef } from 'react';

/** Build Image extension that proxies /site-assets/ src to CMS API for preview. */
function createImageWithSiteAssetProxy(siteId: string) {
  return Image.extend({
    renderHTML({ node }) {
      const attrs = { ...node.attrs };
      if (typeof attrs.src === 'string' && attrs.src.startsWith('/site-assets/')) {
        const path = attrs.src.replace(/^\/site-assets\/?/, '');
        attrs.src = `/api/site-assets?siteId=${encodeURIComponent(siteId)}&path=${encodeURIComponent(path)}`;
      }
      return ['img', attrs];
    },
  }).configure({
    inline: true,
    allowBase64: true,
  });
}

interface TiptapEditorProps {
  value: string;
  onChange: (value: string) => void;
  onImageUpload?: (file: File) => Promise<string>;
  /** Site ID for proxying /site-assets/ images in preview (optional). */
  siteId?: string;
}

const MenuBar = ({ editor, onImageUpload }: { editor: any, onImageUpload?: (f: File) => Promise<string> }) => {
  if (!editor) return null;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && onImageUpload) {
      const url = await onImageUpload(e.target.files[0]);
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    }
  };

  return (
    <div className="border-b p-2 flex flex-wrap gap-1 bg-gray-50 items-center sticky top-0 z-10">
      <div className="flex gap-1 border-r pr-2 mr-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={editor.isActive('bold') ? 'bg-gray-200' : ''}
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={editor.isActive('italic') ? 'bg-gray-200' : ''}
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={editor.isActive('strike') ? 'bg-gray-200' : ''}
      >
        <Strikethrough className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={editor.isActive('code') ? 'bg-gray-200' : ''}
      >
        <Code className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={editor.isActive('heading', { level: 2 }) ? 'bg-gray-200' : ''}
      >
        <Heading1 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={editor.isActive('heading', { level: 3 }) ? 'bg-gray-200' : ''}
      >
        <Heading2 className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={editor.isActive('bulletList') ? 'bg-gray-200' : ''}
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={editor.isActive('orderedList') ? 'bg-gray-200' : ''}
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={editor.isActive('blockquote') ? 'bg-gray-200' : ''}
      >
        <Quote className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
      >
        <ImageIcon className="h-4 w-4" />
      </Button>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImageUpload} 
        className="hidden" 
        accept="image/*"
      />
    </div>
  );
};

export function TiptapEditor({ value, onChange, onImageUpload, siteId }: TiptapEditorProps) {
  const imageExtension = useMemo(
    () => (siteId ? createImageWithSiteAssetProxy(siteId) : Image.configure({ inline: true, allowBase64: true })),
    [siteId]
  );
  const editor = useEditor({
    extensions: [
      StarterKit,
      imageExtension,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none focus:outline-none min-h-[500px] p-4',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && value && editor.getHTML() !== value) {
       if (editor.getText() === '' && value !== '<p></p>') {
         editor.commands.setContent(value);
       }
    }
  }, [value, editor]);

  return (
    <div className="border rounded-md overflow-hidden bg-white">
      <MenuBar editor={editor} onImageUpload={onImageUpload} />
      <EditorContent editor={editor} />
    </div>
  );
}
