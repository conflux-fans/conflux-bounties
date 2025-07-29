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
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Code,
  FunctionSquare,
  Eye,
  EyeOff,
} from 'lucide-react';
import { groupFindingsByFunction, getDisplaySignature, getFunctionContext, FunctionGroup } from '@/lib/functionParser';
import './function-viewer.css';

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

interface FunctionBasedCodeViewerProps {
  sourceCode: string;
  findings: Finding[];
  contractAddress: string;
  language?: string;
  theme?: 'light' | 'dark';
}

const iconsBySeverity = {
  critical: <XCircle className="fv-icon fv-icon--critical" />,
  high:     <AlertCircle className="fv-icon fv-icon--high" />,
  medium:   <AlertTriangle className="fv-icon fv-icon--medium" />,
  low:      <Info className="fv-icon fv-icon--low" />,
};

export function FunctionBasedCodeViewer({
  sourceCode,
  findings,
  contractAddress,
  language = 'solidity',
  theme = 'light',
}: FunctionBasedCodeViewerProps) {
  const [functionGroups, setFunctionGroups] = useState<FunctionGroup[]>([]);
  const [expandedFunctions, setExpandedFunctions] = useState<Set<string>>(new Set());
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([
    'critical',
    'high',
    'medium',
    'low',
  ]);
  const [showFunctionCode, setShowFunctionCode] = useState<Set<string>>(new Set());

  useEffect(() => {
    const groups = groupFindingsByFunction(sourceCode, findings);
    setFunctionGroups(groups);

    // auto‐expand critical/high
    const auto = new Set<string>();
    groups.forEach(g => {
      if (g.findings.some(f => f.severity === 'critical' || f.severity === 'high')) {
        auto.add(g.function.name);
      }
    });
    setExpandedFunctions(auto);
  }, [sourceCode, findings]);

  const toggleFunction = (name: string) => {
    setExpandedFunctions(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const toggleFinding = (id: string) => {
    setExpandedFindings(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleFunctionCode = (name: string) => {
    setShowFunctionCode(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const filteredGroups = functionGroups
    .map(g => ({
      ...g,
      findings: g.findings.filter(f => selectedSeverities.includes(f.severity)),
    }))
    .filter(g => g.findings.length > 0);

  const totalFindings = filteredGroups.reduce((sum, g) => sum + g.findings.length, 0);

  return (
    <div className="fv">
      <div className="fv__controls">
        <div className="fv__info">
          <span className="fv__contract">
            Contract: <code>{contractAddress.slice(-8)}</code>
          </span>
          <span className="fv__stats">
            {filteredGroups.length} functions &middot; {totalFindings} findings
          </span>
        </div>
        <div className="fv__filters">
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
                  'fv__filter-btn',
                  `fv__filter-btn--${sev}`,
                  active && 'fv__filter-btn--active',
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
      </div>

      <div className="fv__groups">
        {filteredGroups.map((group, gi) => {
          const fnName = group.function.name;
          const isOpen = expandedFunctions.has(fnName);
          const showCode = showFunctionCode.has(fnName);
          const maxSeverity = group.findings.reduce(
            (mx, f) =>
              ['critical', 'high', 'medium', 'low'].indexOf(f.severity) <
              ['critical', 'high', 'medium', 'low'].indexOf(mx)
                ? mx
                : f.severity,
            'low' as Finding['severity']
          );

          return (
            <motion.div
              key={fnName}
              className="fv__group"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.1 }}
            >
              <div
                onClick={() => toggleFunction(fnName)}
                className={[
                  'fv__group-header',
                  `fv__group-header--${maxSeverity}`,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <motion.div
                  animate={{ rotate: isOpen ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight className="fv__chevron" />
                </motion.div>
                <FunctionSquare className="fv__func-icon" />
                <div className="fv__func-info">
                  <h3 className="fv__func-name">{fnName}</h3>
                  <p className="fv__func-signature">
                    {getDisplaySignature(group.function)}
                  </p>
                </div>
                <Badge
                  variant={
                    maxSeverity === 'critical'
                      ? 'error'
                      : maxSeverity === 'high'
                      ? 'warning'
                      : maxSeverity === 'medium'
                      ? 'info'
                      : 'default'
                  }
                >
                  {group.findings.length} issue
                  {group.findings.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    className="fv__group-content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="fv__group-controls">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          toggleFunctionCode(fnName);
                        }}
                        className="fv__toggle-code-btn"
                      >
                        {showCode ? <EyeOff /> : <Eye />}
                        {showCode ? 'Hide Code' : 'Show Code'}
                      </button>
                    </div>

                    {showCode && (
                      <div className="fv__code-block">
                        <div className="fv__code-header">
                          <Code className="fv__code-icon" />
                          <span>Function Code</span>
                        </div>
                        <SyntaxHighlighter
                          language={language}
                          style={vscDarkPlus}
                          showLineNumbers
                          startingLineNumber={group.function.startLine}
                          className="fv__syntax"
                          lineProps={(lineNumber: number) => {
                            // Check if this line has findings
                            const hasFindings = group.findings.some(finding => 
                              finding.lines && finding.lines.includes(lineNumber)
                            );
                            
                            if (hasFindings) {
                              // Get the highest severity for this line
                              const lineFindings = group.findings.filter(finding =>
                                finding.lines && finding.lines.includes(lineNumber)
                              );
                              const severities = lineFindings.map(f => f.severity);
                              const highestSeverity = severities.includes('critical') ? 'critical' :
                                                    severities.includes('high') ? 'high' :
                                                    severities.includes('medium') ? 'medium' : 'low';
                              
                              return {
                                className: `code-line-vulnerable ${highestSeverity}`,
                                'data-line-number': lineNumber,
                                title: `Vulnerability found: ${lineFindings.map(f => f.title).join(', ')}`
                              };
                            }
                            
                            return {
                              'data-line-number': lineNumber
                            };
                          }}
                        >
                          {getFunctionContext(sourceCode, group.function, 0)}
                        </SyntaxHighlighter>
                      </div>
                    )}

                    <div className="fv__findings">
                      {group.findings.map((f, fi) => (
                        <div
                          key={f.id}
                          className={[
                            'fv__finding',
                            `fv__finding--${f.severity}`,
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <div
                            className="fv__finding-header"
                            onClick={() => toggleFinding(f.id)}
                          >
                            <div className="fv__finding-info">
                              {iconsBySeverity[f.severity]}
                              <h4 className="fv__finding-title">{f.title}</h4>
                            </div>
                            <motion.div
                              animate={{
                                rotate: expandedFindings.has(f.id) ? 180 : 0,
                              }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronDown className="fv__chevron" />
                            </motion.div>
                          </div>

                          <AnimatePresence>
                            {expandedFindings.has(f.id) && (
                              <motion.div
                                className="fv__finding-details"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                              >
                                {f.description && (
                                  <div className="fv__section">
                                    <h5>Description:</h5>
                                    <p>{f.description}</p>
                                  </div>
                                )}
                                {f.codeSnippet && (
                                  <div className="fv__section">
                                    <h5>Vulnerable Code:</h5>
                                    <pre className="fv__snippet">
                                      <code>{f.codeSnippet}</code>
                                    </pre>
                                  </div>
                                )}
                                {f.recommendation && (
                                  <div className="fv__section fv__recommendation">
                                    <Lightbulb className="fv__lightbulb" />
                                    <div>
                                      <h5>Recommendation:</h5>
                                      <p>{f.recommendation}</p>
                                    </div>
                                  </div>
                                )}
                                <div className="fv__footer">
                                  <span>Category: {f.category}</span>
                                  {f.accuracy !== undefined && (
                                    <span>
                                      &nbsp;&middot;&nbsp;Accuracy:{' '}
                                      {(f.accuracy * 100).toFixed(0)}%
                                    </span>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {filteredGroups.length === 0 && (
          <div className="fv__empty">
            <FunctionSquare className="fv__empty-icon" />
            <p>No functions with findings match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
