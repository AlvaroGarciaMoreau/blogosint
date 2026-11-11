import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Check, Copy, Terminal } from 'lucide-react';
import { slugify } from '../types/osint';

export interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

export function extractTocHeadings(markdown: string): TocHeading[] {
  const lines = markdown.split('\n');
  const headings: TocHeading[] = [];
  let inCodeBlock = false;
  const usedIds = new Map<string, number>();

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = /^(#{2,3})\s+(.+)$/.exec(trimmed);
    if (match) {
      const level = match[1].length as 2 | 3;
      const cleanText = match[2]
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .trim();
      const baseId = slugify(cleanText) || 'seccion';
      const count = usedIds.get(baseId) ?? 0;
      usedIds.set(baseId, count + 1);
      const id = count === 0 ? baseId : `${baseId}-${count}`;
      headings.push({ id, text: cleanText, level });
    }
  }

  return headings;
}

function extractTextFromChildren(children: React.ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).join('');
  }
  if (React.isValidElement<{ children?: React.ReactNode }>(children)) {
    return extractTextFromChildren(children.props.children);
  }
  return '';
}

interface CodeBlockProps {
  children: React.ReactNode;
  language?: string;
}

const CodeBlockWithCopy: React.FC<CodeBlockProps> = ({ children, language }) => {
  const [copied, setCopied] = useState(false);
  const rawText = extractTextFromChildren(children).replace(/\n$/, '');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = rawText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const displayLang = language ? language.replace(/^language-/, '') : 'dork / cli';

  return (
    <div className="my-5 rounded-xl overflow-clip border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100 shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-xs font-mono text-slate-400">
        <span className="inline-flex items-center gap-1.5 uppercase tracking-wider font-semibold text-cyan-400">
          <Terminal className="w-3.5 h-3.5" aria-hidden="true" />
          {displayLang}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copiar código o comando al portapapeles"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span className="text-emerald-300">Copiado</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>
      <pre
        role="region"
        aria-label={`Bloque de código ${displayLang}`}
        tabIndex={0}
        className="p-4 overflow-x-auto text-sm font-mono leading-relaxed m-0 bg-transparent"
      >
        {children}
      </pre>
    </div>
  );
};

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const usedIds = new Map<string, number>();

  const getHeadingId = (children: React.ReactNode) => {
    const text = extractTextFromChildren(children).trim();
    const baseId = slugify(text) || 'seccion';
    const count = usedIds.get(baseId) ?? 0;
    usedIds.set(baseId, count + 1);
    return count === 0 ? baseId : `${baseId}-${count}`;
  };

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none min-w-0 break-words prose-headings:scroll-mt-24 prose-headings:font-bold prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-slate-200 dark:prose-h2:border-slate-800 prose-h3:text-lg prose-h3:mt-6 prose-p:leading-relaxed prose-code:font-mono prose-code:break-all prose-pre:p-0 prose-pre:bg-transparent prose-a:text-cyan-600 dark:prose-a:text-cyan-400 prose-a:break-all">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          h2: ({ children, ...props }) => {
            const id = getHeadingId(children);
            return (
              <h2 id={id} {...props}>
                {children}
              </h2>
            );
          },
          h3: ({ children, ...props }) => {
            const id = getHeadingId(children);
            return (
              <h3 id={id} {...props}>
                {children}
              </h3>
            );
          },
          pre: ({ children }) => {
            let lang = '';
            if (
              React.isValidElement<{ className?: string }>(children) &&
              children.props?.className
            ) {
              const match = /language-(\w+)/.exec(children.props.className);
              if (match) lang = match[1];
            }
            return <CodeBlockWithCopy language={lang}>{children}</CodeBlockWithCopy>;
          },
          code: ({ className, children, ...props }) => {
            const isBlock = Boolean(className && className.includes('language-')) ||
              Boolean(className && className.includes('hljs'));
            if (isBlock) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code
                className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/90 text-cyan-700 dark:text-cyan-300 font-mono text-[0.85em] font-medium before:content-none after:content-none border border-slate-200/70 dark:border-slate-700/70"
                {...props}
              >
                {children}
              </code>
            );
          },
          table: ({ children, ...props }) => (
            <div className="my-5 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm text-left border-collapse m-0" {...props}>
                {children}
              </table>
            </div>
          ),
          th: ({ children, ...props }) => (
            <th
              scope="col"
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800"
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td
              className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/70 text-slate-700 dark:text-slate-300"
              {...props}
            >
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

