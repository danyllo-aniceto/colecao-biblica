'use client';

import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type RichContentProps = {
  value?: string | null;
  className?: string;
};

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

export function RichContent({ value, className }: RichContentProps) {
  const content = value?.trim() ?? '';
  if (!content) {
    return <p className="text-sm text-[var(--text-secondary)]">Sem conteúdo.</p>;
  }

  if (looksLikeHtml(content)) {
    const sanitized = DOMPurify.sanitize(content, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['target'],
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    });

    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
