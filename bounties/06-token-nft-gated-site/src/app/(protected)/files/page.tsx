import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';

const demoFiles = [
  { id: 'whitepaper', name: 'Project Whitepaper.pdf', size: '2.4 MB' },
  { id: 'roadmap', name: 'Roadmap 2025.pdf', size: '1.1 MB' },
  { id: 'alpha-report', name: 'Alpha Research Report.pdf', size: '3.8 MB' },
];

export default async function FilesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Protected Files</h1>
      <p className="text-gray-400">Download files gated by your token holdings. Each download is logged.</p>

      <div className="space-y-3">
        {demoFiles.map((file) => (
          <div key={file.id} className="flex items-center justify-between rounded-lg border border-gray-700 p-4">
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-gray-500">{file.size}</p>
            </div>
            <a
              href={`/api/files/${file.id}`}
              className="rounded bg-conflux-accent px-4 py-2 text-sm font-medium text-black hover:opacity-90"
            >
              Download
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
