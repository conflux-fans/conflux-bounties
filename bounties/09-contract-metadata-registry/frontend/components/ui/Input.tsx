"use client";

import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = "",
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {label}
        </label>
      )}
      <input
        className={`
          h-11 px-4 bg-white border border-zinc-300 rounded-none
          text-sm text-zinc-900 placeholder:text-zinc-400
          focus:outline-none focus:border-black focus:ring-0
          disabled:bg-zinc-50 disabled:cursor-not-allowed
          transition-colors duration-200
          ${error ? "border-red-500 focus:border-red-500" : ""}
          ${className}
        `}
        {...props}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
};
