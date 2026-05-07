import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { apiPost } from '../../api/client';
import { useFilterStore } from '../../stores/filters';

interface ShareButtonProps {
  page: string;
}

/** Create a shareable link for the current view config. */
export function ShareButton({ page }: ShareButtonProps) {
  const { from, to } = useFilterStore();
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      const result = await apiPost<{ slug: string; url: string }>('/shares', {
        config: { page, from, to },
      });
      await navigator.clipboard.writeText(`${window.location.origin}${result.url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /** Silently fail — could add a toast here */
    }
  };

  return (
    <button
      onClick={handleShare}
      className="h-10 px-4 bg-white dark:bg-card-dark rounded-xl flex items-center gap-2 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors font-medium text-sm border border-border dark:border-border-dark"
    >
      {copied ? <Check size={16} /> : <Share2 size={16} />}
      {copied ? 'Copied!' : 'Share'}
    </button>
  );
}
