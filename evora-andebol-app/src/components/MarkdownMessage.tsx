import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  content: string
}

/**
 * Renderiza texto do assistente como rich text (Markdown).
 * Suporta negrito, itálico, listas, tabelas (GFM) e código.
 */
export default function MarkdownMessage({ content }: Props) {
  return (
    <div className="markdown-body text-sm leading-relaxed text-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-bold text-text">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li className="marker:text-primary">{children}</li>,
          h1: ({ children }) => (
            <h1 className="text-base font-bold mb-2 mt-1">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-bold mb-2 mt-1">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold mb-1 mt-1">{children}</h3>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/60 pl-3 my-2 text-text-muted">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = /language-/.test(className || '')
            if (isBlock) {
              return (
                <code
                  className="block bg-surface-2 border border-border rounded-lg p-3 my-2 text-xs overflow-x-auto"
                  {...props}
                >
                  {children}
                </code>
              )
            }
            return (
              <code
                className="bg-surface-2 border border-border rounded px-1.5 py-0.5 text-xs"
                {...props}
              >
                {children}
              </code>
            )
          },
          pre: ({ children }) => <pre className="my-2">{children}</pre>,
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border px-2 py-1 text-left font-semibold bg-surface-2">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-2 py-1">{children}</td>
          ),
          hr: () => <hr className="border-border my-3" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}