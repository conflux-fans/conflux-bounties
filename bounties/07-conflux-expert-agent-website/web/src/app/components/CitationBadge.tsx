'use client';

interface CitationBadgeProps {
    number: number;
    url?: string;
    onClick?: () => void;
}

export default function CitationBadge({ number, url, onClick }: CitationBadgeProps) {
    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (onClick) {
            onClick();
        } else if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <a href={url || '#'} className="citation-badge" onClick={handleClick}>
            {number}
        </a>
    );
}
