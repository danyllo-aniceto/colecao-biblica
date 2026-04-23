'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FormatAlignCenterRoundedIcon from '@mui/icons-material/FormatAlignCenterRounded';
import FormatAlignJustifyRoundedIcon from '@mui/icons-material/FormatAlignJustifyRounded';
import FormatAlignLeftRoundedIcon from '@mui/icons-material/FormatAlignLeftRounded';
import FormatAlignRightRoundedIcon from '@mui/icons-material/FormatAlignRightRounded';
import FormatBoldRoundedIcon from '@mui/icons-material/FormatBoldRounded';
import FormatClearRoundedIcon from '@mui/icons-material/FormatClearRounded';
import FormatColorFillRoundedIcon from '@mui/icons-material/FormatColorFillRounded';
import FormatItalicRoundedIcon from '@mui/icons-material/FormatItalicRounded';
import FormatListBulletedRoundedIcon from '@mui/icons-material/FormatListBulletedRounded';
import FormatListNumberedRoundedIcon from '@mui/icons-material/FormatListNumberedRounded';
import FormatQuoteRoundedIcon from '@mui/icons-material/FormatQuoteRounded';
import FormatUnderlinedRoundedIcon from '@mui/icons-material/FormatUnderlinedRounded';
import HighlightRoundedIcon from '@mui/icons-material/HighlightRounded';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import RedoRoundedIcon from '@mui/icons-material/RedoRounded';
import StrikethroughSRoundedIcon from '@mui/icons-material/StrikethroughSRounded';
import TitleRoundedIcon from '@mui/icons-material/TitleRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import { Button } from '@/components/ui/button';

const toolbarButtonClass =
  'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--gold)_16%,transparent)] disabled:opacity-50';

const toolbarGroupClass =
  'flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-primary)_90%,white)] p-2';

const draftCacheBySyncKey = new Map<string, string>();

function normalizeEditorContent(value: string | undefined) {
  return value && value.trim().length > 0 ? value : '<p></p>';
}

function normalizeSyncKey(syncKey: string | undefined) {
  return syncKey ?? '__default__';
}

export function clearRichTextEditorDrafts(prefix: string) {
  for (const key of draftCacheBySyncKey.keys()) {
    if (key.startsWith(prefix)) {
      draftCacheBySyncKey.delete(key);
    }
  }
}

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowImages?: boolean;
  syncKey?: string;
};

function isActiveButton(active: boolean) {
  return active
    ? 'bg-[linear-gradient(135deg,var(--gold),var(--gold-light))] text-[#2c1b10] border-transparent'
    : '';
}

function IconButton({
  title,
  active,
  onClick,
  disabled,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={`${toolbarButtonClass} ${isActiveButton(Boolean(active))}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

const imageElementClass = 'h-auto max-w-full rounded-xl border border-[var(--border)] object-contain';

function RemovableImageNodeView({ node, deleteNode }: NodeViewProps) {
  const src = typeof node.attrs.src === 'string' ? node.attrs.src : '';
  const alt = typeof node.attrs.alt === 'string' ? node.attrs.alt : 'Imagem inserida';

  return (
    <NodeViewWrapper as="figure" className="group relative my-3 inline-block max-w-full">
      <img src={src} alt={alt} className={imageElementClass} />
      <button
        type="button"
        aria-label="Remover imagem"
        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-black/70 text-white opacity-90 shadow transition-opacity hover:bg-black/80 md:opacity-0 md:group-hover:opacity-100"
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          deleteNode();
        }}
      >
        <CloseRoundedIcon fontSize="small" />
      </button>
    </NodeViewWrapper>
  );
}

const RemovableImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(RemovableImageNodeView);
  },
});

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Não foi possível carregar a imagem.'));
    };
    reader.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
    reader.readAsDataURL(file);
  });
}

export function RichTextEditor({ value, onChange, placeholder, allowImages = false, syncKey }: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const normalizedSyncKey = normalizeSyncKey(syncKey);
  const initialContent = draftCacheBySyncKey.get(normalizedSyncKey) ?? normalizeEditorContent(value);
  const lastSyncedValueRef = useRef(initialContent);
  const lastSyncKeyRef = useRef<string | null>(null);
  const debugEnabledRef = useRef(false);

  const logDebug = (event: string, details?: Record<string, unknown>) => {
    if (!debugEnabledRef.current) {
      return;
    }

    console.debug('[RichTextEditor]', {
      syncKey: normalizedSyncKey,
      event,
      ...details,
    });
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Underline,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      RemovableImage.configure({ allowBase64: true }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class:
          'min-h-40 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-primary)_86%,white)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const html = currentEditor.getHTML();
      draftCacheBySyncKey.set(normalizeSyncKey(syncKey), html);
      lastSyncedValueRef.current = html;
      onChange(html);
      logDebug('update', { htmlLength: html.length });
    },
    onFocus: ({ editor: currentEditor }) => {
      logDebug('focus', { htmlLength: currentEditor.getHTML().length });
    },
    onBlur: ({ editor: currentEditor }) => {
      logDebug('blur', { htmlLength: currentEditor.getHTML().length });
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      const selection = currentEditor.state.selection;
      logDebug('selection-update', { from: selection.from, to: selection.to });
    },
  });

  useEffect(() => {
    debugEnabledRef.current = window.localStorage.getItem('rteDebug') === '1';
  }, []);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const nextSyncKey = normalizeSyncKey(syncKey);
    const normalizedValue = normalizeEditorContent(value);

    // Only resync editor content when context changes (e.g., switching character/form mode).
    if (lastSyncKeyRef.current === nextSyncKey) {
      return;
    }

    const cachedDraft = draftCacheBySyncKey.get(nextSyncKey);
    const nextContent = cachedDraft ?? normalizedValue;

    editor.commands.setContent(nextContent, { emitUpdate: false });
    lastSyncedValueRef.current = nextContent;
    lastSyncKeyRef.current = nextSyncKey;
    logDebug('set-content', { source: cachedDraft ? 'cache' : 'prop', htmlLength: nextContent.length });
  }, [editor, value, syncKey]);

  if (!editor) {
    return <div className="min-h-40 rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]" />;
  }

  const setLink = () => {
    const previousUrl = typeof editor.getAttributes('link').href === 'string' ? editor.getAttributes('link').href : '';
    const url = window.prompt('Informe a URL do link:', previousUrl || 'https://');

    if (url === null) {
      return;
    }

    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: trimmed, target: '_blank', rel: 'noopener noreferrer nofollow' })
      .run();
  };

  return (
    <div className="space-y-3">
      <div className={toolbarGroupClass}>
        <IconButton title="Desfazer" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().chain().focus().undo().run()}>
          <UndoRoundedIcon fontSize="small" />
        </IconButton>
        <IconButton title="Refazer" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().chain().focus().redo().run()}>
          <RedoRoundedIcon fontSize="small" />
        </IconButton>

        <div className="mx-1 h-6 w-px bg-[var(--border)]" />

        <IconButton title="Negrito" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <FormatBoldRoundedIcon fontSize="small" />
        </IconButton>
        <IconButton title="Itálico" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <FormatItalicRoundedIcon fontSize="small" />
        </IconButton>
        <IconButton title="Sublinhado" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <FormatUnderlinedRoundedIcon fontSize="small" />
        </IconButton>
        <IconButton title="Tachado" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <StrikethroughSRoundedIcon fontSize="small" />
        </IconButton>
        <IconButton title="Destacar" active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight({ color: '#FDE68A' }).run()}>
          <HighlightRoundedIcon fontSize="small" />
        </IconButton>

        <div className="mx-1 h-6 w-px bg-[var(--border)]" />

        <IconButton title="Lista com marcadores" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <FormatListBulletedRoundedIcon fontSize="small" />
        </IconButton>
        <IconButton title="Lista numerada" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <FormatListNumberedRoundedIcon fontSize="small" />
        </IconButton>
        <IconButton title="Citação" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <FormatQuoteRoundedIcon fontSize="small" />
        </IconButton>

        <div className="mx-1 h-6 w-px bg-[var(--border)]" />

        <IconButton title="Alinhar à esquerda" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
          <FormatAlignLeftRoundedIcon fontSize="small" />
        </IconButton>
        <IconButton title="Centralizar" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
          <FormatAlignCenterRoundedIcon fontSize="small" />
        </IconButton>
        <IconButton title="Alinhar à direita" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
          <FormatAlignRightRoundedIcon fontSize="small" />
        </IconButton>
        <IconButton title="Justificar" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
          <FormatAlignJustifyRoundedIcon fontSize="small" />
        </IconButton>

        <div className="mx-1 h-6 w-px bg-[var(--border)]" />

        <IconButton title="Inserir ou editar link" active={editor.isActive('link')} onClick={setLink}>
          <LinkRoundedIcon fontSize="small" />
        </IconButton>
        <IconButton title="Remover link" onClick={() => editor.chain().focus().unsetLink().run()} disabled={!editor.isActive('link')}>
          <LinkOffRoundedIcon fontSize="small" />
        </IconButton>

        <div className="mx-1 h-6 w-px bg-[var(--border)]" />

        <label title="Cor do texto" className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--gold)_16%,transparent)]">
          <FormatColorFillRoundedIcon fontSize="small" />
          <input
            type="color"
            className="sr-only"
            onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
          />
        </label>

        <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-2">
          <TitleRoundedIcon fontSize="small" />
          <select
            aria-label="Estilo de título"
            className="h-8 bg-transparent text-xs text-[var(--text-primary)] outline-none"
            value={editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'}
            onChange={(event) => {
              const next = event.target.value;
              if (next === 'h2') {
                editor.chain().focus().setHeading({ level: 2 }).run();
                return;
              }
              if (next === 'h3') {
                editor.chain().focus().setHeading({ level: 3 }).run();
                return;
              }
              editor.chain().focus().setParagraph().run();
            }}
          >
            <option value="p">Parágrafo</option>
            <option value="h2">Título H2</option>
            <option value="h3">Título H3</option>
          </select>
        </div>

        <IconButton title="Limpar formatação" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
          <FormatClearRoundedIcon fontSize="small" />
        </IconButton>

        {allowImages ? (
          <>
            <div className="mx-1 h-6 w-px bg-[var(--border)]" />
            <IconButton title="Inserir imagem por URL" onClick={() => {
              const imageUrl = window.prompt('Cole a URL da imagem:');
              if (imageUrl?.trim()) {
                editor.chain().focus().setImage({ src: imageUrl.trim() }).run();
              }
            }}>
              <ImageOutlinedIcon fontSize="small" />
            </IconButton>
            <IconButton title="Upload de imagem" onClick={() => fileInputRef.current?.click()}>
              <ImageOutlinedIcon fontSize="small" />
            </IconButton>
          </>
        ) : null}
      </div>

      {allowImages ? (
        <div className="hidden">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }

              const dataUrl = await fileToDataUrl(file);
              editor.chain().focus().setImage({ src: dataUrl }).run();
              event.currentTarget.value = '';
            }}
          />
        </div>
      ) : null}

      {placeholder ? <p className="text-xs text-[var(--text-secondary)]">{placeholder}</p> : null}
      <EditorContent editor={editor} />
    </div>
  );
}
