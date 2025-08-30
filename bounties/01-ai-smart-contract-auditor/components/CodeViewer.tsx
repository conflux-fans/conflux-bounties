'use client';

import React, { useState, useMemo, CSSProperties } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './code-viewer.css';

interface Finding {
  id: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  swc_id?: string;
  cwe_id?: string;
  title: string;
  description: string;
  lines?: number[];
  location?: string;
  recommendation?: string;
}

interface CodeViewerProps {
  code: string;
  findings?: Finding[];
  language?: string;
  theme?: 'light' | 'dark';
  showLineNumbers?: boolean;
  className?: string;
  maxHeight?: string;
}

interface LineAnnotation {
  line: number;
  findings: Finding[];
  severity: Finding['severity'];
}

export default function CodeViewer({
  code,
  findings = [],
  language = 'solidity',
  theme = 'light',
  showLineNumbers = true,
  className = '',
  maxHeight = '600px',
}: CodeViewerProps) {
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [highlightedFindings, setHighlightedFindings] = useState<string[]>([]);

  const getSeverityLevel = (s: Finding['severity']): number =>
    s === 'critical' ? 4 : s === 'high' ? 3 : s === 'medium' ? 2 : 1;

  const getSeverityClasses = (s: Finding['severity']) => ({
    container: `cv-line-accent--${s}`,
    dot: `cv-line-dot--${s}`,
    text: `cv-text--${s}`,
    border: `cv-border--${s}`,
  });

  const lineAnnotations = useMemo(() => {
    const map = new Map<number, LineAnnotation>();
    findings.forEach(f => {
      f.lines?.forEach(ln => {
        const existing = map.get(ln);
        if (existing) {
          existing.findings.push(f);
          if (getSeverityLevel(f.severity) > getSeverityLevel(existing.severity)) {
            existing.severity = f.severity;
          }
        } else {
          map.set(ln, { line: ln, findings: [f], severity: f.severity });
        }
      });
    });
    return map;
  }, [findings]);

  const findingsBySeverity = useMemo(() => ({
    critical: findings.filter(f => f.severity === 'critical'),
    high:     findings.filter(f => f.severity === 'high'),
    medium:   findings.filter(f => f.severity === 'medium'),
    low:      findings.filter(f => f.severity === 'low'),
  }), [findings]);

  const toggleFindingHighlight = (id: string) =>
    setHighlightedFindings(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  const jumpToLine = (ln: number) => {
    setSelectedLine(ln);
    document
      .querySelector(`[data-line-number="${ln}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className={['cv', className].filter(Boolean).join(' ')} data-testid="code-viewer">
      <div className="cv__panels">
        {/* Code panel */}
        <div className="cv__code-panel">
          <div className="cv__code-header">
            <div className="cv__code-title">Source Code</div>
            <div className="cv__code-meta">{language.toUpperCase()}</div>
            <div className="cv__code-stats">
              {findings.length} issue{findings.length !== 1 && 's'}
            </div>
            <button 
              data-testid="copy-button" 
              onClick={() => navigator.clipboard.writeText(code)}
              className="cv__copy-button"
            >
              Copy
            </button>
          </div>
          <div className="cv__code-content" style={{ maxHeight }}>
            <SyntaxHighlighter
              language={language}
              style={theme === 'dark' ? vscDarkPlus : prism}
              showLineNumbers={showLineNumbers}
              lineNumberContainerStyle={{ float: 'left', paddingRight: '10px' }}
              lineNumberStyle={{ fontSize: '12px' }}
              customStyle={{ margin: 0, padding: '1rem', maxHeight, overflow: 'auto' }}
              lineProps={(lineNumber: number) => ({
                'data-line-number': lineNumber,
                className: 'cv__line-wrapper',
              })}
              renderer={props => {
                const { rows, useInlineStyles } = props;
                return (
                  <pre className="cv__pre">
                    <code className="cv__code">
                      {rows.map((node: any, i: number) => {
                        const ln = i + 1;
                        const ann = lineAnnotations.get(ln);
                        const selected = selectedLine === ln;
                        const highlighted = highlightedFindings.some(id =>
                          ann?.findings.some(f => f.id === id)
                        );
                        const sevCls = ann ? getSeverityClasses(ann.severity) : null;

                        return (
                          <div
                            key={i}
                            data-line-number={ln}
                            className={[
                              'cv__line',
                              ann && sevCls?.container,
                              selected && 'cv__line--selected',
                              highlighted && 'cv__line--highlighted',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            onClick={() => setSelectedLine(selected ? null : ln)}
                          >
                            <span
                              className={[
                                'cv__line-number',
                                ann && sevCls?.text,
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            >
                              {ln}
                            </span>
                            {ann && <span className={sevCls!.dot} />}
                            <span
                              className="cv__line-content"
                              style={useInlineStyles && node.style ? node.style : {}}
                            >
                              {node.children}
                            </span>
                          </div>
                        );
                      })}
                    </code>
                  </pre>
                );
              }}
            >
              {code}
            </SyntaxHighlighter>
          </div>
        </div>

        {/* Findings panel */}
        <div className="cv__findings-panel">
          {selectedLine && lineAnnotations.get(selectedLine) && (
            <div className="cv__finding-details">
              <div className="cv__finding-details-header">
                Line {selectedLine} Issues
              </div>
              {lineAnnotations.get(selectedLine)!.findings.map(f => {
                const sevCls = getSeverityClasses(f.severity);
                return (
                  <div key={f.id} className={['cv__finding-item', sevCls.container].join(' ')}>
                    <div className="cv__finding-item-header">
                      <span className={['cv__finding-severity', sevCls.text].join(' ')}>
                        {f.severity.toUpperCase()}
                      </span>
                      {f.lines && f.lines.length > 0 && (
                        <button
                          onClick={() => jumpToLine(f.lines![0])}
                          className="cv__jump-btn"
                        >
                          L{f.lines![0]}
                        </button>
                      )}
                    </div>
                    <div className="cv__finding-title">{f.title}</div>
                    <div className="cv__finding-desc">{f.description}</div>
                    {f.recommendation && (
                      <div className="cv__finding-recommendation">
                        Fix: {f.recommendation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="cv__findings-list">
            {Object.entries(findingsBySeverity).map(([sev, items]) => {
              if (!items.length) return null;
              const sevCls = getSeverityClasses(sev as Finding['severity']);
              return (
                <div key={sev} className="cv__findings-group">
                  <div className={['cv__findings-group-header', sevCls.container].join(' ')}>
                    {sev} ({items.length})
                  </div>
                  {items.map(f => (
                    <div
                      key={f.id}
                      className={[
                        'cv__finding-list-item',
                        highlightedFindings.includes(f.id) && 'cv__finding-list-item--highlighted',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => toggleFindingHighlight(f.id)}
                    >
                      <div className="cv__finding-list-title">{f.title}</div>
                      {f.lines && f.lines.length > 0 && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            jumpToLine(f.lines![0]);
                          }}
                          className="cv__finding-list-jump"
                        >
                          L{f.lines![0]}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="cv__legend">
            <div className="cv__legend-title">Legend</div>
            {(['critical', 'high', 'medium', 'low'] as const).map(s => {
              const sevCls = getSeverityClasses(s);
              return (
                <div key={s} className="cv__legend-item">
                  <span className={sevCls.dot} /> {s}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Specialized for Solidity
export function SolidityCodeViewer(props: Omit<CodeViewerProps, 'language'>) {
  return <CodeViewer {...props} language="solidity" />;
}

// Multi-file viewer
export function MultiFileCodeViewer({
  files,
  findings,
  className = '',
}: {
  files: { name: string; content: string }[];
  findings: Finding[];
  className?: string;
}) {
  const [selected, setSelected] = useState(0);
  const currentFindings = findings.filter(
    f => f.location === files[selected]?.name || !f.location
  );

  return (
    <div className={['cv-multi', className].filter(Boolean).join(' ')}>
      {files.length > 1 && (
        <div className="cv-multi__tabs">
          {files.map((file, idx) => (
            <button
              key={idx}
              onClick={() => setSelected(idx)}
              className={[
                'cv-multi__tab',
                selected === idx && 'cv-multi__tab--active',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {file.name}
            </button>
          ))}
        </div>
      )}
      <CodeViewer code={files[selected].content} findings={currentFindings} />
    </div>
  );
}
