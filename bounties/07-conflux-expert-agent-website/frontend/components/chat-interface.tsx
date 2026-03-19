"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { Send, Loader2, Copy, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Array<{ id: number; title: string; url: string }>;
  toolResult?: { tool: string; result: Record<string, unknown> };
  timestamp: Date;
}

export function ChatInterface() {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const messagesCardRef = React.useRef<HTMLDivElement | null>(null);
  const [fixedTop, setFixedTop] = React.useState<number | null>(null);

  React.useEffect(() => {
    const updateFixedTop = () => {
      const el = messagesCardRef.current;
      if (!el) {
        setFixedTop(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      setFixedTop(rect.top + 16);
    };

    updateFixedTop();
    window.addEventListener("resize", updateFixedTop);
    return () => window.removeEventListener("resize", updateFixedTop);
  }, [messages.length]);

  const downloadTranscript = () => {
    if (messages.length === 0) return;

    // Generate Markdown transcript
    let markdown = "# Conflux Expert Chat Transcript\n\n";
    markdown += `**Date:** ${new Date().toLocaleString()}\n\n`;
    markdown += "---\n\n";

    messages.forEach((msg) => {
      const role = msg.role === "user" ? "**You**" : "**Conflux Expert**";
      markdown += `### ${role}\n\n`;
      markdown += `${msg.content}\n\n`;

      // Add citations if present
      if (msg.citations && msg.citations.length > 0) {
        markdown += "**Sources:**\n\n";
        msg.citations.forEach((citation) => {
          markdown += `- [${citation.id}] [${citation.title}](${citation.url})\n`;
        });
        markdown += "\n";
      }

      markdown += "---\n\n";
    });

    // Create download
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conflux-chat-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, history: messages }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.content,
        citations: data.citations,
        toolResult: data.tool_result ?? undefined,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const hasMessages = messages.length > 0;

  React.useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {hasMessages && fixedTop !== null && (
        <div
          style={{ top: fixedTop + "px" }}
          className="fixed right-12 z-40 hidden sm:block"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={downloadTranscript}
            className="gap-2 shadow-md"
          >
            <Download className="h-4 w-4" />
            Download Transcript
          </Button>
        </div>
      )}

      {hasMessages && (
        <ScrollArea className="flex-1">
          <div
            ref={messagesCardRef}
            className="max-w-3xl mx-auto p-4 space-y-6"
          >
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}

            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      )}

      <div
        className={cn(
          "transition-all duration-300",
          !hasMessages
            ? "flex-1 flex flex-col items-center justify-center px-4 pb-40 gap-4"
            : "border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0",
        )}
      >
        {!hasMessages && (
          <div className="text-center text-muted-foreground">
            <h3 className="text-xl font-semibold text-foreground mb-1">
              Welcome to Conflux Expert
            </h3>
            <p className="text-sm">Ask me anything about Conflux blockchain!</p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className={cn(
            "w-full max-w-3xl mx-auto",
            !hasMessages ? "p-0" : "p-4",
          )}
        >
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about Conflux..."
              disabled={isLoading}
              className="flex-1"
              autoFocus={hasMessages}
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const [copied, setCopied] = React.useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "group relative",
        message.role === "user" ? "flex justify-end" : "flex justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[85%] min-w-0 overflow-hidden rounded-lg px-4 py-3 text-sm",
          message.role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-muted",
        )}
      >
        <div className="min-w-0">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
            components={{
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              a: ({ node, ...props }) => (
                <a
                  {...props}
                  className="text-xs block hover:underline opacity-80 hover:opacity-100 transition-opacity"
                  target="_blank"
                  rel="noopener noreferrer"
                />
              ),
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              pre: ({ node, ...props }) => (
                <pre
                  {...props}
                  className="overflow-x-auto rounded-md bg-black/10 dark:bg-white/10 p-3 my-2 text-xs"
                />
              ),
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              code: ({ node, ...props }) => (
                <code {...props} className="break-words whitespace-pre-wrap" />
              ),
              p: ({ node, ...props }) => (
                <p {...props} className="mb-2 last:mb-0 break-words" />
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {message.toolResult && (
          <div className="mt-2 pt-2 border-t border-border/40">
            <p className="text-xs font-semibold opacity-70 mb-1">
              🌐 Live data ·{" "}
              <span className="font-mono">{message.toolResult.tool}</span>
            </p>
            <pre className="text-xs bg-black/10 dark:bg-white/10 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words">
              {JSON.stringify(message.toolResult.result, null, 2)}
            </pre>
          </div>
        )}

        {message.citations && message.citations.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/40 space-y-1">
            <p className="text-xs font-medium opacity-70">Sources:</p>
            {message.citations.map((citation) => (
              <a
                key={citation.id}
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs block hover:underline opacity-80 hover:opacity-100 transition-opacity"
              >
                [{citation.id}] {citation.title}
              </a>
            ))}
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-10 top-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
          onClick={copyToClipboard}
        >
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>
    </div>
  );
}
