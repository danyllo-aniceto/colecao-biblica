import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type RichContentProps = {
  value?: string | null;
  className?: string;
};

// Imagens do texto carregam só ao chegar perto da tela; links que abrem em outra aba não dão acesso à janela de origem.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'IMG') {
    node.setAttribute('loading', 'lazy');
    node.setAttribute('decoding', 'async');
  }
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

export function RichContent({ value, className }: RichContentProps) {
  const content = value?.trim() ?? '';
  if (!content) {
    return <p className="text-sm text-muted">Sem conteúdo.</p>;
  }

  if (looksLikeHtml(content)) {
    const sanitized = DOMPurify.sanitize(content, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['target'],
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    });

    return <div className={`rich-content ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: sanitized }} />;
  }

  return (
    <div className={`rich-content ${className ?? ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
