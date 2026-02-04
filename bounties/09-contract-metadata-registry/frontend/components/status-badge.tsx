"use client";

import { ShieldCheck, Clock, XCircle } from "lucide-react";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case "approved":
    case "Verified":
      return (
        <span className="flex items-center text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 px-2 py-0.5">
          <ShieldCheck className="w-3 h-3 mr-1" /> Verified
        </span>
      );
    case "pending":
    case "Pending":
      return (
        <span className="flex items-center text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5">
          <Clock className="w-3 h-3 mr-1" /> Pending
        </span>
      );
    case "rejected":
    case "Rejected":
      return (
        <span className="flex items-center text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 px-2 py-0.5">
          <XCircle className="w-3 h-3 mr-1" /> Rejected
        </span>
      );
    default:
      return (
        <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-500 px-2 py-0.5">
          {status}
        </span>
      );
  }
}
