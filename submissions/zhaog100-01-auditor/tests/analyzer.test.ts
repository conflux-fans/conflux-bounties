import { computeSummary } from '@/lib/analyzer';
import type { AuditFinding } from '@/types/audit';

const makeFinding = (severity: string): AuditFinding => ({
  id: 'F001',
  category: 'security',
  severity: severity as any,
  title: 'Test',
  description: 'Test desc',
  lines: [],
  recommendation: 'Fix it',
});

describe('computeSummary', () => {
  it('returns low risk for no security findings', () => {
    const summary = computeSummary([], [], []);
    expect(summary.overallRisk).toBe('low');
    expect(summary.criticalCount).toBe(0);
  });

  it('returns medium risk for medium findings', () => {
    const summary = computeSummary([makeFinding('medium')], [], []);
    expect(summary.overallRisk).toBe('medium');
    expect(summary.mediumCount).toBe(1);
  });

  it('returns high risk for high findings', () => {
    const summary = computeSummary([makeFinding('high')], [], []);
    expect(summary.overallRisk).toBe('high');
    expect(summary.highCount).toBe(1);
  });

  it('returns critical risk for critical findings', () => {
    const summary = computeSummary([makeFinding('critical')], [], []);
    expect(summary.overallRisk).toBe('critical');
    expect(summary.criticalCount).toBe(1);
  });

  it('counts all findings from all categories', () => {
    const summary = computeSummary(
      [makeFinding('high')],
      [makeFinding('low')],
      [makeFinding('info')],
    );
    expect(summary.totalFindings).toBe(3);
  });

  it('only counts security findings for severity', () => {
    const summary = computeSummary(
      [makeFinding('critical')],
      [makeFinding('critical')], // gas optimization with critical should not count
      [],
    );
    expect(summary.criticalCount).toBe(1);
  });

  it('low severity includes info level', () => {
    const summary = computeSummary(
      [makeFinding('low'), makeFinding('info')],
      [],
      [],
    );
    expect(summary.lowCount).toBe(2);
  });
});
