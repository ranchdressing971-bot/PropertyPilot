import clsx from "clsx";

interface PageContentProps {
  children: React.ReactNode;
  className?: string;
}

/** Consistent mobile-first page padding and max-width. */
export function PageContent({ children, className }: PageContentProps) {
  return (
    <div
      className={clsx(
        "mx-auto w-full max-w-7xl space-y-6 px-5 py-6 sm:space-y-8 sm:px-6 sm:py-8 lg:px-8",
        className
      )}
    >
      {children}
    </div>
  );
}
