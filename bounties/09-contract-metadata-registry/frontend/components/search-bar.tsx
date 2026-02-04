"use client";

import { Search } from "lucide-react";
import { Button } from "./ui/Button";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: () => void;
}

export function SearchBar({ value, onChange, onSearch }: SearchBarProps) {
  return (
    <div className="flex w-full md:w-auto gap-2">
      <div className="relative flex-1 md:w-64">
        <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Search by name or address..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch?.()}
          className="w-full h-10 pl-10 pr-4 bg-zinc-50 border border-zinc-200 rounded-none text-sm focus:outline-none focus:border-black transition-colors"
        />
      </div>
      <Button variant="outline" size="md" onClick={onSearch}>
        Filter
      </Button>
    </div>
  );
}
