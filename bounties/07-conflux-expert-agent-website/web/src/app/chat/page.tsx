'use client';

import { useState, useRef, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Message from '../components/Message';
import SourceCard from '../components/SourceCard';
import ChatInput from '../components/ChatInput';
import { UserIcon, AIIcon, MenuIcon } from '../components/Icons';
import MarkdownRenderer from '../components/MarkdownRenderer';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    citations?: { index: number; title: string; url: string }[];
    toolUsed?: string | null;
    toolResult?: string | null;
}

export default function ChatPage() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [activeChat, setActiveChat] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMessage = text.trim();
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    history: messages.map(m => ({
                        role: m.role === 'assistant' ? 'model' : 'user',
                        content: m.content
                    }))
                })
            });

            if (!response.ok) throw new Error('Chat request failed');

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No reader');

            const decoder = new TextDecoder();
            let assistantMessage = '';
            let citations: { index: number; title: string; url: string }[] = [];
            let toolUsed: string | null = null;
            let toolResult: string | null = null;

            // Add empty assistant message
            setMessages(prev => [...prev, { role: 'assistant', content: '', citations: [] }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

                for (const line of lines) {
                    try {
                        const data = JSON.parse(line.slice(6));

                        if (data.type === 'metadata') {
                            citations = data.citations || [];
                            toolUsed = data.toolUsed;
                            toolResult = data.toolResult;
                        } else if (data.type === 'text') {
                            assistantMessage += data.content;
                            setMessages(prev => {
                                const updated = [...prev];
                                updated[updated.length - 1] = {
                                    role: 'assistant',
                                    content: assistantMessage,
                                    citations,
                                    toolUsed,
                                    toolResult
                                };
                                return updated;
                            });
                        }
                    } catch {
                        // Skip malformed JSON
                    }
                }
            }
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, an error occurred. Please try again.'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Helper to generate source card colors based on index
    const getSourceColor = (index: number) => {
        const colors = ['#E8F5E9', '#E3F2FD', '#FFF3E0', '#F3E5F5', '#E0F7FA'];
        return colors[index % colors.length];
    };

    return (
        <div className="app-container">
            <Sidebar
                activeChat={activeChat}
                onChatSelect={setActiveChat}
                isOpen={isSidebarOpen}
                onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            />

            <main className="main-content">
                {!isSidebarOpen && (
                    <button
                        className="sidebar-open-btn"
                        onClick={() => setIsSidebarOpen(true)}
                        aria-label="Open Sidebar"
                    >
                        <MenuIcon />
                    </button>
                )}
                <div className="chat-scroll-area">
                    {messages.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">C</div>
                            <h2>Ask me about Conflux</h2>
                            <p>
                                I can help you with Conflux blockchain, smart contracts, eSpace, Core Space, and more.
                            </p>
                            <div className="suggestion-buttons">
                                {['How do I run a node?', 'What is eSpace?', 'CFX token utilities'].map(q => (
                                    <button
                                        key={q}
                                        className="suggestion-btn"
                                        onClick={() => sendMessage(q)}
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="chat-container">
                            {messages.map((message, index) => (
                                <Message
                                    key={index}
                                    isUser={message.role === 'user'}
                                    avatar={message.role === 'user' ? <UserIcon /> : <AIIcon />}
                                >
                                    {message.role === 'user' ? (
                                        message.content
                                    ) : (
                                        <>
                                            {/* Source Cards */}
                                            {message.citations && message.citations.length > 0 && (
                                                <div className="sources-grid">
                                                    {message.citations.map((citation, idx) => (
                                                        <SourceCard
                                                            key={idx}
                                                            id={`source-${index}-${idx + 1}`}
                                                            meta="Conflux Docs"
                                                            title={citation.title}
                                                            faviconColor={getSourceColor(idx)}
                                                            url={citation.url}
                                                        />
                                                    ))}
                                                </div>
                                            )}

                                            {/* Message Content */}
                                            <MarkdownRenderer content={message.content} messageIndex={index} />

                                            {/* Tool Result */}
                                            {message.toolUsed && message.toolResult && (
                                                <div className="tool-result">
                                                    <p className="tool-result-label">
                                                        <span>⚡</span> Live Blockchain Data
                                                    </p>
                                                    <div className="tool-result-content">
                                                        {message.toolResult}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </Message>
                            ))}

                            {/* Loading indicator */}
                            {isLoading && messages[messages.length - 1]?.content === '' && (
                                <Message isUser={false} avatar={<AIIcon />}>
                                    <div className="loading-dots">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                </Message>
                            )}

                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                <ChatInput onSend={sendMessage} disabled={isLoading} />
            </main>
        </div>
    );
}
