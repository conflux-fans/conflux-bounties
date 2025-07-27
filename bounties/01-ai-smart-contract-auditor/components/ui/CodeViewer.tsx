'use client';

import { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Badge } from './Badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  Info,
  AlertTriangle,
  XCircle,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Lightbulb,
} from 'lucide-react';
import './code-viewer.css';

interface Finding {
  id: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  lines?: number[];
  codeSnippet?: string;
  location?: string;
  recommendation?: string;
  accuracy?: number;
}

interface CodeViewerProps {
  sourceCode: string;
  findings: Finding[];
  contractAddress: string;
  language?: string;
  theme?: 'light' | 'dark';
}

const iconsBySeverity = {
  critical: <XCircle className="code-viewer__icon--critical" />,
  high:     <AlertCircle className="code-viewer__icon--high" />,
  medium:   <AlertTriangle className="code-viewer__icon--medium" />,
  low:      <Info className="code-viewer__icon--low" />,
};

export function CodeViewer({
  sourceCode,
  findings,
  contractAddress,
  language = 'solidity',
  theme = 'light',
}: CodeViewerProps) {
  const [highlightedLines, setHighlightedLines] = useState<Map<number, Finding[]>>(new Map());
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([
    'critical',
    'high',
    'medium',
    'low',
  ]);
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
  const [showAllAnnotations, setShowAllAnnotations] = useState(false);

  useEffect(() => {
    const map = new Map<number, Finding[]>();
    findings.forEach(f => {
      f.lines?.forEach(ln => {
        if (!map.has(ln)) map.set(ln, []);
        map.get(ln)!.push(f);
      });
    });
    setHighlightedLines(map);
  }, [findings]);

  const toggleFinding = (id: string) => {
    setExpandedFindings(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (showAllAnnotations) {
      setExpandedFindings(new Set());
    } else {
      const all = new Set<string>();
      highlightedLines.forEach(list =>
        list.forEach(f => {
          if (selectedSeverities.includes(f.severity)) {
            all.add(f.id);
          }
        })
      );
      setExpandedFindings(all);
    }
    setShowAllAnnotations(!showAllAnnotations);
  };

  const getLineStyle = (ln: number): React.CSSProperties => {
    const anns = highlightedLines.get(ln)?.filter(f => selectedSeverities.includes(f.severity)) || [];
    if (!anns.length) return {};
    const order: Finding['severity'][] = ['critical', 'high', 'medium', 'low'];
    const sev = order.find(s => anns.some(f => f.severity === s))!;
    return {
      backgroundColor: `var(--code-viewer-line-bg-${sev})`,
      borderLeft:      `4px solid var(--code-viewer-line-border-${sev})`,
      paddingLeft:     '8px',
    };
  };

  const lines = sourceCode.split('\n');
  const seen = new Set<string>();
  const rows = lines.map((txt, i) => {
    const ln = i + 1;
    const all = highlightedLines.get(ln) || [];
    const vis = all.filter(f => selectedSeverities.includes(f.severity));
    const toShow = vis.filter(f => {
      if (seen.has(f.id)) return false;
      if (f.lines && f.lines.length > 1) {
        const first = Math.min(...f.lines);
        if (ln === first) {
          seen.add(f.id);
          return true;
        }
        return false;
      }
      seen.add(f.id);
      return true;
    });
    return { ln, txt, vis, toShow };
  });

  const filtered = findings.filter(f => selectedSeverities.includes(f.severity));
  const vulnerableLines = Array.from(highlightedLines.keys()).filter(ln =>
    highlightedLines.get(ln)?.some(f => selectedSeverities.includes(f.severity))
  ).length;

  return (
    <div className="code-viewer">
      {/* Controls */}
      <div className="code-viewer__controls">
        <div className="code-viewer__info">
          <span className="code-viewer__contract">
            Contract: <code>{contractAddress.slice(-8)}</code>
          </span>
          <span className="code-viewer__stats">
            {vulnerableLines} lines, {filtered.length} findings
          </span>
        </div>
        <div className="code-viewer__actions">
          <div className="code-viewer__filters">
            {(['critical', 'high', 'medium', 'low'] as const).map(sev => {
              const count = findings.filter(f => f.severity === sev).length;
              if (!count) return null;
              const active = selectedSeverities.includes(sev);
              return (
                <button
                  key={sev}
                  onClick={() =>
                    setSelectedSeverities(prev =>
                      prev.includes(sev) ? prev.filter(s => s !== sev) : [...prev, sev]
                    )
                  }
                  className={[
                    'code-viewer__filter-button',
                    `code-viewer__filter-button--${sev}`,
                    active && 'code-viewer__filter-button--active',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {iconsBySeverity[sev]}
                  <span>
                    {sev} ({count})
                  </span>
                </button>
              );
            })}
          </div>
          <button onClick={toggleAll} className="code-viewer__toggle-button">
            {showAllAnnotations ? <ChevronDown /> : <ChevronRight />}
            {showAllAnnotations ? 'Collapse All' : 'Expand All'}
          </button>
          <button
            onClick={() => setShowLineNumbers(v => !v)}
            className="code-viewer__toggle-button"
          >
            {showLineNumbers ? <EyeOff /> : <Eye />}
            Line Numbers
          </button>
        </div>
      </div>

      {/* Code */}
      <div className="code-viewer__code">
        <div className="code-viewer__code-header">
          <span>Source Code</span>
          <span>{filtered.length} annotations</span>
        </div>
        <pre className="code-viewer__lines">
          {rows.map(({ ln, txt, vis, toShow }) => (
            <div
              key={ln}
              className={[
                'code-viewer__line',
                vis.length && 'code-viewer__line--highlighted',
              ]
                .filter(Boolean)
                .join(' ')}
              style={vis.length ? getLineStyle(ln) : undefined}
            >
              {showLineNumbers && (
                <span className="code-viewer__line-number">{ln}</span>
              )}
              <span className="code-viewer__line-content">{txt || ' '}</span>
              {toShow.length > 0 && (
                <div className="code-viewer__annotation-indicators">
                  {toShow.map(f => (
                    <button
                      key={f.id}
                      onClick={() => toggleFinding(f.id)}
                      className={[
                        'code-viewer__annotation-button',
                        `code-viewer__annotation-button--${f.severity}`,
                        expandedFindings.has(f.id) && 'code-viewer__annotation-button--open',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {iconsBySeverity[f.severity]}
                      <span className="code-viewer__annotation-title">{f.title}</span>
                      {expandedFindings.has(f.id) ? <ChevronDown /> : <ChevronRight />}
                    </button>
                  ))}
                </div>
              )}
              {toShow.map(f => (
                <AnimatePresence key={f.id}>
                  {expandedFindings.has(f.id) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="code-viewer__annotation-details"
                    >
                      <div
                        className={[
                          'code-viewer__finding',
                          `code-viewer__finding--${f.severity}`,
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <div className="code-viewer__finding-header">
                          <div className="code-viewer__finding-title">
                            {iconsBySeverity[f.severity]}
                            <h4>{f.title}</h4>
                            <Badge
                              variant={
                                f.severity === 'critical'
                                  ? 'error'
                                  : f.severity === 'high'
                                  ? 'warning'
                                  : f.severity === 'medium'
                                  ? 'info'
                                  : 'outline'
                              }
                              size="sm"
                            >
                              {f.severity}
                            </Badge>
                          </div>
                          <span className="code-viewer__finding-meta">
                            {f.lines && f.lines.length > 1
                              ? `Lines ${Math.min(...f.lines)}–${Math.max(...f.lines)}`
                              : `Line ${ln}`}
                          </span>
                        </div>

                        <div className="code-viewer__finding-section">
                          <strong>Description:</strong>
                          <p>{f.description}</p>
                        </div>

                        {f.codeSnippet && (
                          <div className="code-viewer__finding-section">
                            <strong>Vulnerable Code:</strong>
                            <pre className="code-viewer__snippet">
                              <code>{f.codeSnippet}</code>
                            </pre>
                          </div>
                        )}

                        {f.location && (
                          <div className="code-viewer__finding-section">
                            <strong>Location:</strong>
                            <p>{f.location}</p>
                          </div>
                        )}

                        {f.recommendation && (
                          <div className="code-viewer__finding-section code-viewer__recommendation">
                            <Lightbulb className="code-viewer__recommendation-icon" />
                            <div className="code-viewer__recommendation-content">
                              <strong>Recommendation:</strong>
                              <p>{f.recommendation}</p>
                            </div>
                          </div>
                        )}

                        <div className="code-viewer__finding-section code-viewer__finding-footer">
                          <span>Category: {f.category}</span>
                          {f.accuracy !== undefined && (
                            <span> • Accuracy: {(f.accuracy * 100).toFixed(0)}%</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              ))}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
