'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import CitationBadge from './CitationBadge';

interface MarkdownRendererProps {
    content: string;
    messageIndex?: number;
}

const remarkCitation = (options: { prefix?: string } = {}) => {
    return (tree: any) => {
        visit(tree, 'text', (node: any, index: number | undefined, parent: any) => {
            if (index === undefined) return;
            const regex = /\[(\d+)\]/g;
            if (parent.type !== 'link' && parent.type !== 'code' && regex.test(node.value)) {
                const children = [];
                let lastIndex = 0;
                let match;

                while ((match = regex.exec(node.value)) !== null) {
                    const [fullMatch, citationNumber] = match;
                    const matchIndex = match.index;

                    if (matchIndex > lastIndex) {
                        children.push({ type: 'text', value: node.value.slice(lastIndex, matchIndex) });
                    }

                    const prefix = options.prefix || 'source-';
                    children.push({
                        type: 'link',
                        url: `#${prefix}${citationNumber}`,
                        data: { hProperties: { className: 'citation-link', 'data-citation': citationNumber } },
                        children: [{ type: 'text', value: fullMatch }]
                    });

                    lastIndex = matchIndex + fullMatch.length;
                }

                if (lastIndex < node.value.length) {
                    children.push({ type: 'text', value: node.value.slice(lastIndex) });
                }

                parent.children.splice(index, 1, ...children);
                return index + children.length;
            }
        });
    };
};

export default function MarkdownRenderer({ content, messageIndex = 0 }: MarkdownRendererProps) {
    const prefix = `source-${messageIndex}-`;

    return (
        <div className="markdown-content">
            <ReactMarkdown
                remarkPlugins={[remarkGfm, [remarkCitation, { prefix }]]}
                components={{
                    // Headings
                    h1: ({ children }) => <h1 className="md-h1">{children}</h1>,
                    h2: ({ children }) => <h2 className="md-h2">{children}</h2>,
                    h3: ({ children }) => <h3 className="md-h3">{children}</h3>,
                    h4: ({ children }) => <h4 className="md-h4">{children}</h4>,

                    // Paragraphs
                    p: ({ children }) => <p className="md-p">{children}</p>,

                    // Lists
                    ul: ({ children }) => <ul className="md-ul">{children}</ul>,
                    ol: ({ children }) => <ol className="md-ol">{children}</ol>,
                    li: ({ children }) => <li className="md-li">{children}</li>,

                    // Code
                    code: ({ className, children, ...props }) => {
                        const isInline = !className;
                        if (isInline) {
                            return <code className="md-code-inline" {...props}>{children}</code>;
                        }
                        return (
                            <code className={`md-code-block ${className || ''}`} {...props}>
                                {children}
                            </code>
                        );
                    },
                    pre: ({ children }) => <pre className="md-pre">{children}</pre>,

                    // Links
                    a: ({ href, children, ...props }) => {
                        const safeHref = href || '';
                        if (safeHref.startsWith(`#${prefix}`)) {
                            const numberStr = safeHref.split('-').pop();
                            if (!numberStr) return <a href={href} {...props}>{children}</a>;
                            const number = parseInt(numberStr, 10);

                            return (
                                <CitationBadge
                                    number={number}
                                    onClick={() => {
                                        const element = document.getElementById(safeHref.slice(1));
                                        if (element) {
                                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            // Add highlight effect
                                            element.style.borderColor = 'var(--accent-primary)';
                                            setTimeout(() => {
                                                element.style.borderColor = 'var(--border-light)';
                                            }, 2000);
                                        }
                                    }}
                                />
                            );
                        }

                        return (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="md-link" {...props}>
                                {children}
                            </a>
                        );
                    },

                    // Emphasis
                    strong: ({ children }) => <strong className="md-strong">{children}</strong>,
                    em: ({ children }) => <em className="md-em">{children}</em>,

                    // Blockquote
                    blockquote: ({ children }) => <blockquote className="md-blockquote">{children}</blockquote>,

                    // Horizontal rule
                    hr: () => <hr className="md-hr" />,

                    // Tables (GFM)
                    table: ({ children }) => <table className="md-table">{children}</table>,
                    thead: ({ children }) => <thead className="md-thead">{children}</thead>,
                    tbody: ({ children }) => <tbody className="md-tbody">{children}</tbody>,
                    tr: ({ children }) => <tr className="md-tr">{children}</tr>,
                    th: ({ children }) => <th className="md-th">{children}</th>,
                    td: ({ children }) => <td className="md-td">{children}</td>,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
