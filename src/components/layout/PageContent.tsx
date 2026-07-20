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
        "mx-auto w-full max-w-6xl space-y-5 px-5 py-6 sm:space-y-6 sm:px-8 sm:py-8 lg:mx-0 lg:pl-0 lg:pr-8",
        className
      )}
    >
      {children}
    </div>
  );
}
