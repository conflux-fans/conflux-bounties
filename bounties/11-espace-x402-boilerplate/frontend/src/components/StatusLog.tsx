'use client';

interface StatusLogProps {
  messages: string[];
}

export default function StatusLog({ messages }: StatusLogProps) {
  if (messages.length === 0) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mt-4 font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
      {messages.map((msg, i) => (
        <div key={i} className="text-gray-400">
          <span className="text-gray-600 mr-2">[{String(i + 1).padStart(2, '0')}]</span>
          {msg}
        </div>
      ))}
    </div>
  );
}
