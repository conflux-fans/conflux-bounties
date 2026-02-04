"use client";

import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  className = "",
  icon,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 rounded-none";

  const variants = {
    primary:
      "bg-black text-white hover:bg-zinc-800 active:bg-zinc-900 border border-transparent",
    secondary:
      "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 border border-transparent",
    outline:
      "bg-transparent text-zinc-900 border border-zinc-300 hover:border-zinc-900 hover:bg-zinc-50",
    ghost:
      "bg-transparent text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-5 text-sm",
    lg: "h-12 px-8 text-base",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
};
