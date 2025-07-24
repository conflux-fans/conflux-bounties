import { generateReports } from '../lib/reportGenerator';

describe('reportGenerator', () => {
  describe('generateReports', () => {
    it('should generate reports with empty findings', () => {
      const findings = [];
      const result = generateReports(findings);

      expect(result.json).toBeDefined();
      expect(result.markdown).toBeDefined();
      expect(result.json.findings).toEqual([]);
      expect(result.json.summary.total).toBe(0);
      expect(result.markdown).toContain('Aucun problème détecté');
    });

    it('should generate reports with findings', () => {
      const findings = [
        {
          id: '1',
          severity: 'high' as const,
          title: 'Test Finding',
          description: 'Test description',
          location: 'line 10',
          recommendation: 'Fix it'
        }
      ];

      const result = generateReports(findings);

      expect(result.json.findings).toEqual(findings);
      expect(result.json.summary.total).toBe(1);
      expect(result.json.summary.high).toBe(1);
      expect(result.markdown).toContain('Test Finding');
      expect(result.markdown).toContain('🟠');
    });

    it('should count findings by severity correctly', () => {
      const findings = [
        { id: '1', severity: 'critical' as const, title: 'Critical', description: 'Critical issue' },
        { id: '2', severity: 'high' as const, title: 'High', description: 'High issue' },
        { id: '3', severity: 'medium' as const, title: 'Medium', description: 'Medium issue' },
        { id: '4', severity: 'low' as const, title: 'Low', description: 'Low issue' },
        { id: '5', severity: 'low' as const, title: 'Low2', description: 'Another low issue' }
      ];

      const result = generateReports(findings);

      expect(result.json.summary).toEqual({
        total: 5,
        critical: 1,
        high: 1,
        medium: 1,
        low: 2
      });
    });

    it('should include generatedAt timestamp', () => {
      const findings = [];
      const result = generateReports(findings);

      expect(result.json.generatedAt).toBeDefined();
      expect(new Date(result.json.generatedAt)).toBeInstanceOf(Date);
    });
  });
});