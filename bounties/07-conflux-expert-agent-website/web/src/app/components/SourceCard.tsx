'use client';

interface SourceCardProps {
    id?: string;
    meta: string;
    title: string;
    faviconColor: string;
    url?: string;
}

export default function SourceCard({ id, meta, title, faviconColor, url }: SourceCardProps) {
    const handleClick = (e: React.MouseEvent) => {
        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
        e.preventDefault();
    };

    return (
        <a href={url || '#'} className="source-card" onClick={handleClick}>
            <div className="source-meta">
                <div className="source-favicon" style={{ backgroundColor: faviconColor }}></div>
                <span>{meta}</span>
            </div>
            <div className="source-title">{title}</div>
        </a>
    );
}
