import { AccessLogTable } from '@/components/AccessLogTable';

export default function AdminLogsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Access Logs</h1>
        <a href="/admin" className="text-sm text-gray-400 hover:text-white">← Back to Rules</a>
      </div>
      <AccessLogTable />
    </div>
  );
}
