"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Bot,
  User,
  Loader2,
  Trash2,
  Wallet,
  Shield,
  Activity,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  action?: string;
  payment?: { amount: string; endpoint: string; txHash?: string };
}

interface AgentBudget {
  totalSpent: string;
  dailySpent: string;
  remainingCap: string;
  remainingDaily: string;
  transactions: number;
  address?: string;
  paused?: boolean;
  balanceCfx?: string;
  balanceUsdt0?: string;
  chainId?: number;
  network?: "testnet" | "mainnet";
  mode: "live" | "readonly";
}

export default function AgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [budget, setBudget] = useState<AgentBudget | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(true);
  const [budgetLoading, setBudgetLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Fetch budget on mount
  const fetchBudget = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/agent/budget`);
      if (res.ok) {
        const data = await res.json();
        setBudget(data);
      }
    } catch {
      // Budget endpoint not available
    } finally {
      setBudgetLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  const sendMessage = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId }),
      });
      const data = await res.json();
      if (data.sessionId) setSessionId(data.sessionId);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response || data.error || "No response",
          action: data.action,
          payment: data.payment,
        },
      ]);
      // Refresh budget after each message (payments may have occurred)
      if (data.budget) {
        setBudget(data.budget);
      } else {
        fetchBudget();
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Failed to reach the agent API. Is the backend running?",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setSessionId(null);
  };

  const formatUsdt = (val: string) => {
    const n = parseFloat(val);
    if (isNaN(n)) return val;
    return n.toFixed(2);
  };

  const remainingPct = budget
    ? Math.max(
        0,
        Math.min(
          100,
          (parseFloat(budget.remainingCap) /
            (parseFloat(budget.remainingCap) + parseFloat(budget.totalSpent) || 1)) *
            100
        )
      )
    : 100;

  return (
    <div className="rounded-2xl border border-gray-700/50 bg-[#0F2744]/40 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700/50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-conflux-teal to-blue-500 flex items-center justify-center">
            <Bot size={12} className="text-white" />
          </div>
          <span className="text-sm font-medium text-white">x402 Agent</span>
          {budget && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                budget.paused
                  ? "bg-red-500/15 text-red-400 border border-red-500/20"
                  : budget.mode === "live"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
              }`}
            >
              {budget.paused ? "Paused" : budget.mode === "live" ? "Live" : "Read-only"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="text-gray-500 hover:text-gray-300 transition-colors p-1"
              title="Clear chat"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Budget Panel */}
      <div className="border-b border-gray-700/50">
        <button
          onClick={() => setBudgetOpen(!budgetOpen)}
          className="w-full flex items-center justify-between px-5 py-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <Wallet size={12} />
            <span>Agent Wallet</span>
            {budget?.network && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase ${
                budget.network === "mainnet"
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              }`}>
                {budget.network} ({budget.chainId || (budget.network === "mainnet" ? 1030 : 71)})
              </span>
            )}
          </div>
          {budgetOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {budgetOpen && (
          <div className="px-5 pb-3 space-y-2">
            {budgetLoading ? (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 size={10} className="animate-spin" />
                Loading wallet info...
              </div>
            ) : budget ? (
              <>
                {/* Address */}
                {budget.address && (
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-mono">
                    <span className="truncate">{budget.address}</span>
                  </div>
                )}
                {/* Wallet Balances */}
                {(budget.balanceCfx || budget.balanceUsdt0) && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-800/40 rounded-lg px-2.5 py-1.5">
                      <div className="text-[10px] text-gray-500">CFX Balance</div>
                      <div className="text-xs text-gray-300 font-medium">
                        {budget.balanceCfx || "0"} CFX
                      </div>
                    </div>
                    <div className="bg-gray-800/40 rounded-lg px-2.5 py-1.5">
                      <div className="text-[10px] text-gray-500">USDT0 Balance</div>
                      <div className="text-xs text-gray-300 font-medium">
                        {budget.balanceUsdt0 || "0"} USDT0
                      </div>
                    </div>
                  </div>
                )}
                {/* Budget bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Spend Cap</span>
                    <span className="text-gray-300 font-medium">
                      {formatUsdt(budget.totalSpent)} / {formatUsdt(
                        String(parseFloat(budget.totalSpent) + parseFloat(budget.remainingCap))
                      )}{" "}
                      USDT0
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        remainingPct > 50
                          ? "bg-emerald-500"
                          : remainingPct > 20
                          ? "bg-amber-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${100 - remainingPct}%` }}
                    />
                  </div>
                </div>
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-gray-800/40 rounded-lg px-2.5 py-1.5">
                    <div className="text-[10px] text-gray-500 flex items-center gap-1">
                      <Shield size={9} /> Daily Remaining
                    </div>
                    <div className="text-xs text-gray-300 font-medium">
                      {formatUsdt(budget.remainingDaily)} USDT0
                    </div>
                  </div>
                  <div className="bg-gray-800/40 rounded-lg px-2.5 py-1.5">
                    <div className="text-[10px] text-gray-500 flex items-center gap-1">
                      <Activity size={9} /> Transactions
                    </div>
                    <div className="text-xs text-gray-300 font-medium">
                      {budget.transactions}
                    </div>
                  </div>
                  <div className="bg-gray-800/40 rounded-lg px-2.5 py-1.5">
                    <div className="text-[10px] text-gray-500 flex items-center gap-1">
                      <Zap size={9} /> Cap Left
                    </div>
                    <div className="text-xs text-gray-300 font-medium">
                      {formatUsdt(budget.remainingCap)} USDT0
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-[11px] text-gray-500">
                Agent wallet not configured. Set <code className="text-gray-400">AGENT_PRIVATE_KEY</code> in .env to enable autonomous payments.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ minHeight: 280, maxHeight: 380 }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-conflux-teal/20 to-blue-500/20 flex items-center justify-center mb-3">
              <Bot size={20} className="text-conflux-teal/60" />
            </div>
            <p className="text-sm text-gray-400 mb-2">x402 AI Agent</p>
            <p className="text-xs text-gray-500 max-w-sm">
              I can call APIs and autonomously pay for premium endpoints using USDT0 via the x402 protocol.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-4 justify-center">
              {[
                "Get free data",
                "Fetch premium analytics",
                "Run a simulation",
                "Show my budget",
                "What endpoints are available?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    sendMessage(suggestion);
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-gray-700/50 text-gray-400 hover:text-white hover:border-conflux-teal/30 hover:bg-conflux-teal/5 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}
          >
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-conflux-teal/20 to-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot size={12} className="text-conflux-teal" />
              </div>
            )}
            <div className="max-w-[80%] space-y-1.5">
              {/* Action badge */}
              {msg.role === "assistant" && msg.action && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-conflux-teal/10 text-conflux-teal border border-conflux-teal/20 font-mono">
                    {msg.action}
                  </span>
                  {msg.payment && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Paid {msg.payment.amount} USDT0
                    </span>
                  )}
                </div>
              )}
              {/* Message content */}
              <div
                className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-conflux-teal/15 text-gray-200 border border-conflux-teal/20"
                    : "bg-gray-800/50 text-gray-300 border border-gray-700/30"
                }`}
              >
                {msg.content}
              </div>
              {/* Tx hash link */}
              {msg.payment?.txHash && (
                <a
                  href={`https://evmtestnet.confluxscan.io/tx/${msg.payment.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-conflux-teal hover:underline font-mono truncate block"
                >
                  tx: {msg.payment.txHash.slice(0, 10)}...{msg.payment.txHash.slice(-8)}
                </a>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-6 h-6 rounded-full bg-conflux-teal/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User size={12} className="text-conflux-teal" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-conflux-teal/20 to-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Bot size={12} className="text-conflux-teal" />
            </div>
            <div className="bg-gray-800/50 border border-gray-700/30 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
              <Loader2 size={14} className="text-conflux-teal animate-spin" />
              <span className="text-xs text-gray-400">Processing...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-700/50">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the agent to call an API, check data, or make a payment..."
            disabled={loading}
            className="flex-1 bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-conflux-teal/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-2 rounded-lg bg-conflux-teal/15 text-conflux-teal hover:bg-conflux-teal/25 transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-conflux-teal/20"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
