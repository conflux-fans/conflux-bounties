import type { ReactNode } from "react";

const maxW = {
  sm: "max-w-lg",
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
  full: "max-w-none",
} as const;

type Props = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  size?: keyof typeof maxW;
  eyebrow?: string;
  eyebrowVariant?: "accent" | "amber";
  title?: string;
  titleAs?: "h1" | "h2";
  description?: string;
};

export function PageShell({
  children,
  className = "",
  contentClassName = "",
  size = "md",
  eyebrow,
  eyebrowVariant = "accent",
  title,
  titleAs = "h1",
  description,
}: Props) {
  const TitleTag = titleAs;
  const ebClass = eyebrowVariant === "amber" ? "eyebrow-amber" : "eyebrow";

  return (
    <main
      className={`mx-auto px-5 py-14 sm:px-6 sm:py-20 ${maxW[size]} ${className}`}
    >
      <div className={contentClassName}>
        {eyebrow ? <p className={ebClass}>{eyebrow}</p> : null}
        {title ? (
          <TitleTag
            className={`font-display font-semibold tracking-tight text-ink ${
              eyebrow ? "mt-3" : ""
            } ${titleAs === "h1" ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"}`}
          >
            {title}
          </TitleTag>
        ) : null}
        {description ? (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">
            {description}
          </p>
        ) : null}
        {children}
      </div>
    </main>
  );
}
