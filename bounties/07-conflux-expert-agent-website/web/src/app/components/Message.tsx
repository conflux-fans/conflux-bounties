'use client';

import { ReactNode } from 'react';

interface MessageProps {
    isUser: boolean;
    avatar: ReactNode;
    children: ReactNode;
}

export default function Message({ isUser, avatar, children }: MessageProps) {
    return (
        <div className={`message ${isUser ? 'user-message' : 'ai-message'}`}>
            <div className={`message-avatar ${isUser ? 'user-avatar' : 'ai-avatar'}`}>
                {avatar}
            </div>
            <div className="message-content">
                {children}
            </div>
        </div>
    );
}
