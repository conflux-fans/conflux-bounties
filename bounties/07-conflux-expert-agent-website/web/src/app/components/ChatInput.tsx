'use client';

import { useState, useRef, useEffect } from 'react';
import { AttachIcon, SendIcon } from './Icons';

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
}

export default function ChatInput({ onSend, disabled = false }: ChatInputProps) {
    const [message, setMessage] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [message]);

    const handleSend = () => {
        if (message.trim() && !disabled) {
            onSend(message);
            setMessage('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="input-wrapper">
            <div className="input-container">
                <button className="attach-btn" aria-label="Attach file">
                    <AttachIcon />
                </button>
                <textarea
                    ref={textareaRef}
                    placeholder="Ask anything about Conflux..."
                    rows={1}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                />
                <button
                    className="send-btn"
                    aria-label="Send message"
                    disabled={!message.trim() || disabled}
                    onClick={handleSend}
                >
                    <SendIcon />
                </button>
            </div>
        </div>
    );
}
