"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { UploadCloud, FileCode, CheckCircle2, AlertCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function SubmissionForm() {
  const { address } = useAccount();
  const [isDragOver, setIsDragOver] = useState(false);
  const [abiFile, setAbiFile] = useState<File | null>(null);
  const [abiJson, setAbiJson] = useState<any[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ id: number; status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    contractAddress: "",
    name: "",
    description: "",
    version: "",
    website: "",
    tags: "",
    bytecodeHash: "",
    compilerName: "solc",
    compilerVersion: "",
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setIsDragOver(true);
    else if (e.type === "dragleave") setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processFile(e.target.files[0]);
  };

  const processFile = async (file: File) => {
    setAbiFile(file);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const abi = Array.isArray(parsed) ? parsed : parsed.abi;
      if (!Array.isArray(abi)) throw new Error("Invalid ABI format");
      setAbiJson(abi);
      setError(null);
    } catch {
      setError("Invalid ABI JSON file");
      setAbiJson(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!abiJson || !address) return;

    setSubmitting(true);
    setError(null);

    try {
      const metadata = {
        name: form.name,
        description: form.description,
        abi: abiJson,
        bytecodeHash: form.bytecodeHash || "0x" + "0".repeat(64),
        compiler: {
          name: form.compilerName,
          version: form.compilerVersion,
        },
        website: form.website || undefined,
        tags: form.tags
          ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : undefined,
      };

      const res = await fetch(`${API_URL}/api/submissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": address,
        },
        body: JSON.stringify({
          contractAddress: form.contractAddress,
          metadata,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12">
        <CheckCircle2 className="w-12 h-12 mx-auto text-green-600 mb-4" />
        <h2 className="text-2xl font-[family-name:var(--font-space-grotesk)] font-semibold mb-2">
          Submission Created
        </h2>
        <p className="text-zinc-500 mb-4">
          Submission #{result.id} is now <strong>{result.status}</strong>.
        </p>
        <Button onClick={() => setResult(null)}>Submit Another</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8 pb-6 border-b border-zinc-200">
        <h2 className="text-2xl font-[family-name:var(--font-space-grotesk)] font-semibold text-zinc-900">
          Submit Metadata
        </h2>
        <p className="text-zinc-500 text-sm mt-1">
          Register your contract to index it on the Conflux ecosystem. Owner
          verification will be required.
        </p>
      </div>

      <form className="space-y-8" onSubmit={handleSubmit}>
        {/* Section 1: Core Info */}
        <div className="space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-900 flex items-center gap-2">
            <span className="w-6 h-6 bg-zinc-900 text-white flex items-center justify-center text-xs rounded-none">
              1
            </span>
            Contract Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Contract Address"
              placeholder="0x..."
              className="font-mono"
              value={form.contractAddress}
              onChange={(e) => updateField("contractAddress", e.target.value)}
              required
            />
            <Input
              label="Contract Name"
              placeholder="e.g. MyToken V1"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Description
            </label>
            <textarea
              rows={4}
              className="w-full p-4 bg-white border border-zinc-300 rounded-none text-sm focus:outline-none focus:border-black resize-none"
              placeholder="Describe the purpose and functionality of this contract..."
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
            />
          </div>
        </div>

        {/* Section 2: Artifacts */}
        <div className="space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-900 flex items-center gap-2">
            <span className="w-6 h-6 bg-zinc-900 text-white flex items-center justify-center text-xs rounded-none">
              2
            </span>
            Artifacts
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2 block">
                Contract ABI (.json)
              </label>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`
                  relative h-32 w-full border-2 border-dashed rounded-none flex flex-col items-center justify-center transition-colors
                  ${isDragOver ? "border-black bg-zinc-50" : "border-zinc-300 bg-white hover:bg-zinc-50"}
                  ${abiFile && abiJson ? "border-green-500 bg-green-50" : ""}
                `}
              >
                <input
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleFileChange}
                  accept=".json"
                />

                {abiFile && abiJson ? (
                  <div className="flex items-center text-green-700">
                    <CheckCircle2 className="w-6 h-6 mr-2" />
                    <span className="text-sm font-medium">{abiFile.name}</span>
                  </div>
                ) : (
                  <div className="text-center p-4">
                    <FileCode className="w-8 h-8 mx-auto text-zinc-300 mb-2" />
                    <p className="text-sm text-zinc-600 font-medium">
                      Drag & drop ABI file
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">or click to browse</p>
                  </div>
                )}
              </div>
            </div>

            <Input
              label="Bytecode Hash"
              placeholder="0x..."
              className="font-mono"
              value={form.bytecodeHash}
              onChange={(e) => updateField("bytecodeHash", e.target.value)}
            />
            <Input
              label="Compiler Version"
              placeholder="e.g. 0.8.28"
              value={form.compilerVersion}
              onChange={(e) => updateField("compilerVersion", e.target.value)}
            />
            <Input
              label="Website URL"
              placeholder="https://"
              value={form.website}
              onChange={(e) => updateField("website", e.target.value)}
            />
            <Input
              label="Tags (comma-separated)"
              placeholder="DeFi, Token, AMM"
              value={form.tags}
              onChange={(e) => updateField("tags", e.target.value)}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 pt-6 border-t border-zinc-200">
          <div className="text-xs text-zinc-500 flex items-center mr-auto">
            <AlertCircle className="w-4 h-4 mr-2" />
            On-chain submission requires a wallet signature.
          </div>
          <Button
            variant="primary"
            size="lg"
            type="submit"
            disabled={submitting || !abiJson}
            icon={<UploadCloud className="w-4 h-4" />}
          >
            {submitting ? "Submitting..." : "Sign & Submit"}
          </Button>
        </div>
      </form>
    </div>
  );
}
