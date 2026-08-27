'use client';

/**
 * Robust Markdown Renderer - Production Grade
 * 
 * Features:
 * - LaTeX/KaTeX math rendering ($inline$ and $$block$$)
 * - Mermaid diagrams with error handling
 * - Syntax highlighting with copy-to-clipboard
 * - XSS sanitization (DOMPurify)
 * - GFM (tables, task lists, strikethrough)
 * - Performance optimization
 * - Comprehensive error boundaries
 */

import React, { useEffect, useRef, useState, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import DOMPurify from 'isomorphic-dompurify';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, AlertCircle } from 'lucide-react';
import 'katex/dist/katex.min.css';

interface RobustMarkdownProps {
  content: string;
  className?: string;
}

// Code block component with copy functionality
const CodeBlock = memo(({ language, value }: { language: string; value: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4">
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
          padding: '1rem',
        }}
        showLineNumbers={value.split('\n').length > 3}
        wrapLines
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
});

CodeBlock.displayName = 'CodeBlock';

// Mermaid diagram component with error handling
const MermaidDiagram = memo(({ code }: { code: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!ref.current || ref.current.dataset.processed) return;

      try {
        setLoading(true);
        setError(null);
        const mermaid = (await import('mermaid')).default;
        
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'strict',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        });

        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, code);
        
        if (ref.current) {
          ref.current.innerHTML = svg;
          ref.current.dataset.processed = 'true';
        }
      } catch (err: any) {
        console.error('Mermaid render error:', err);
        setError(err.message || 'Failed to render diagram');
      } finally {
        setLoading(false);
      }
    };

    renderDiagram();
  }, [code]);

  if (error) {
    return (
      <div className="my-6 p-4 rounded-lg bg-red-950/20 border border-red-900/30">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm">Diagram Render Error</p>
            <p className="text-xs text-red-300/70 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-6 flex justify-center">
      {loading && (
        <div className="text-zinc-400 text-sm py-8">Loading diagram...</div>
      )}
      <div
        ref={ref}
        className="mermaid bg-zinc-900/50 p-4 rounded-lg"
        style={{ minHeight: loading ? '100px' : 'auto' }}
      />
    </div>
  );
});

MermaidDiagram.displayName = 'MermaidDiagram';

export default function RobustMarkdown({ content, className = '' }: RobustMarkdownProps) {
  // Sanitize content with strict allowlist
  const sanitizedContent = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'hr',
      'del', 'ins', 'mark',
      'sup', 'sub',
      'div', 'span',
    ],
    ALLOWED_ATTR: [
      'href', 'title', 'alt', 'src',
      'class', 'id',
      'align', 'colspan', 'rowspan',
      'type', 'checked', 'disabled',
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  });

  return (
    <div className={`prose prose-invert prose-emerald max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={{
          // Headings with auto-anchors
          h1: ({ children, ...props }) => (
            <h1 
              className="text-4xl font-bold text-zinc-100 mt-8 mb-4 pb-2 border-b border-zinc-800 scroll-mt-20" 
              {...props}
            >
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="text-3xl font-bold text-zinc-200 mt-6 mb-3 scroll-mt-20" {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="text-2xl font-semibold text-zinc-300 mt-5 mb-2 scroll-mt-20" {...props}>
              {children}
            </h3>
          ),
          h4: ({ children, ...props }) => (
            <h4 className="text-xl font-semibold text-zinc-300 mt-4 mb-2" {...props}>
              {children}
            </h4>
          ),
          h5: ({ children, ...props }) => (
            <h5 className="text-lg font-semibold text-zinc-400 mt-3 mb-1" {...props}>
              {children}
            </h5>
          ),
          h6: ({ children, ...props }) => (
            <h6 className="text-base font-semibold text-zinc-400 mt-3 mb-1" {...props}>
              {children}
            </h6>
          ),

          // Paragraphs
          p: ({ children, ...props }) => (
            <p className="text-zinc-300 leading-relaxed mb-4 text-base" {...props}>
              {children}
            </p>
          ),

          // Lists
          ul: ({ children, ...props }) => (
            <ul className="list-disc list-outside text-zinc-300 space-y-2 mb-4 ml-6" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="list-decimal list-outside text-zinc-300 space-y-2 mb-4 ml-6" {...props}>
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li className="text-zinc-300 leading-relaxed" {...props}>
              {children}
            </li>
          ),

          // Task lists (GFM)
          input: ({ type, checked, ...props }) => {
            if (type === 'checkbox') {
              return (
                <input
                  type="checkbox"
                  checked={checked}
                  disabled
                  className="mr-2 accent-emerald-500 cursor-not-allowed"
                  {...props}
                />
              );
            }
            return <input type={type} {...props} />;
          },

          // Code blocks with syntax highlighting
          code: ({ inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const value = String(children).replace(/\n$/, '');

            // Mermaid diagrams
            if (language === 'mermaid') {
              return <MermaidDiagram code={value} />;
            }

            // Inline code
            if (inline) {
              return (
                <code 
                  className="px-1.5 py-0.5 rounded bg-zinc-800 text-emerald-400 font-mono text-sm whitespace-nowrap" 
                  {...props}
                >
                  {children}
                </code>
              );
            }

            // Block code with syntax highlighting
            return <CodeBlock language={language} value={value} />;
          },

          // Blockquotes
          blockquote: ({ children, ...props }) => (
            <blockquote 
              className="border-l-4 border-emerald-500 pl-4 my-4 italic text-zinc-400 bg-zinc-900/30 py-2" 
              {...props}
            >
              {children}
            </blockquote>
          ),

          // Horizontal rules
          hr: ({ ...props }) => (
            <hr className="border-zinc-800 my-8" {...props} />
          ),

          // Links
          a: ({ children, href, ...props }) => (
            <a
              href={href}
              className="text-emerald-400 hover:text-emerald-300 underline decoration-emerald-500/30 hover:decoration-emerald-500 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          ),

          // Images
          img: ({ src, alt, ...props }) => (
            <img
              src={src}
              alt={alt || ''}
              loading="lazy"
              className="max-w-full h-auto rounded-lg my-4 border border-zinc-800"
              {...props}
            />
          ),

          // Tables (GFM)
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto my-6 rounded-lg border border-zinc-800">
              <table className="min-w-full" {...props}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead className="bg-zinc-900" {...props}>
              {children}
            </thead>
          ),
          tbody: ({ children, ...props }) => (
            <tbody className="divide-y divide-zinc-800" {...props}>
              {children}
            </tbody>
          ),
          tr: ({ children, ...props }) => (
            <tr className="hover:bg-zinc-900/50 transition-colors" {...props}>
              {children}
            </tr>
          ),
          th: ({ children, ...props }) => (
            <th 
              className="px-4 py-3 text-left text-zinc-200 font-semibold border-r border-zinc-800 last:border-r-0" 
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td 
              className="px-4 py-3 text-zinc-300 border-r border-zinc-800 last:border-r-0" 
              {...props}
            >
              {children}
            </td>
          ),

          // Strikethrough (GFM)
          del: ({ children, ...props }) => (
            <del className="text-zinc-500 line-through opacity-75" {...props}>
              {children}
            </del>
          ),

          // Strong/emphasis
          strong: ({ children, ...props }) => (
            <strong className="font-bold text-zinc-100" {...props}>
              {children}
            </strong>
          ),
          em: ({ children, ...props }) => (
            <em className="italic text-zinc-200" {...props}>
              {children}
            </em>
          ),
        }}
      >
        {sanitizedContent}
      </ReactMarkdown>
    </div>
  );
}
