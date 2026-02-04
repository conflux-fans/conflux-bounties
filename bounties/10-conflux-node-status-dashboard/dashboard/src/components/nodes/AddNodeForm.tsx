import { useState } from "react";
import { Plus } from "lucide-react";
import { createNode } from "../../api/client";

interface AddNodeFormProps {
  onCreated: () => void;
}

/** Form to add a new monitored node */
export function AddNodeForm({ onCreated }: AddNodeFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rpcUrl, setRpcUrl] = useState("");
  const [spaceType, setSpaceType] = useState<"core" | "espace">("core");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await createNode({ name, rpcUrl, spaceType });
      setName("");
      setRpcUrl("");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create node");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-zinc-900 border border-zinc-900 hover:bg-zinc-800 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] active:translate-y-[1px] active:shadow-none transition-all uppercase tracking-wide"
      >
        <Plus size={14} />
        Add Node
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-6 border border-zinc-200"
    >
      <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-900 mb-4 flex items-center gap-2">
        <div className="w-2 h-2 bg-zinc-900" />
        Add New Node
      </h3>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 text-xs font-mono uppercase">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="My Node"
            className="w-full px-3 py-2 border border-zinc-200 bg-zinc-50 text-zinc-900 text-sm font-mono focus:ring-2 focus:ring-zinc-900 outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
            RPC URL
          </label>
          <input
            type="url"
            value={rpcUrl}
            onChange={(e) => setRpcUrl(e.target.value)}
            required
            placeholder="https://main.confluxrpc.com"
            className="w-full px-3 py-2 border border-zinc-200 bg-zinc-50 text-zinc-900 text-sm font-mono focus:ring-2 focus:ring-zinc-900 outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
            Space Type
          </label>
          <select
            value={spaceType}
            onChange={(e) => setSpaceType(e.target.value as "core" | "espace")}
            className="w-full px-3 py-2 border border-zinc-200 bg-zinc-50 text-zinc-900 text-sm font-mono focus:ring-2 focus:ring-zinc-900 outline-none uppercase"
          >
            <option value="core">Core Space</option>
            <option value="espace">eSpace</option>
          </select>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 text-xs font-bold text-white bg-zinc-900 border border-zinc-900 hover:bg-zinc-800 disabled:opacity-50 transition-all uppercase tracking-wide"
        >
          {loading ? "Adding..." : "Add Node"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-5 py-2.5 text-xs font-bold text-zinc-600 bg-white border border-zinc-200 hover:border-zinc-400 hover:text-zinc-900 transition-all uppercase tracking-wide"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
