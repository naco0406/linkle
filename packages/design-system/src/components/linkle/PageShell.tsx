import * as React from 'react';
import { cn } from '../../lib/cn.js';

export interface PageShellProps extends React.HTMLAttributes<HTMLElement> {
  /** Render slot pinned to the top of the shell (e.g. brand row, timer). */
  header?: React.ReactNode;
  /** Footer slot (e.g. meta, version). */
  footer?: React.ReactNode;
  /** Use `main` by default; opt into `section` on nested pages. */
  as?: 'main' | 'section';
}

/**
 * Canonical mobile-first page container. Every route in apps/web and apps/admin
 * should compose from this — no ad-hoc page wrappers.
 */
export function PageShell({
  header,
  footer,
  as: Tag = 'main',
  className,
  children,
  ...props
}: PageShellProps) {
  return (
    <Tag
      className={cn(
        'max-w-shell mx-auto flex min-h-dvh w-full flex-col',
        'px-4 pb-10 pt-4 md:px-6 md:pt-8',
        className,
      )}
      {...props}
    >
      {header ? <div className="mb-4">{header}</div> : null}
      <div className="flex flex-1 flex-col gap-4">{children}</div>
      {footer ? <div className="mt-6">{footer}</div> : null}
    </Tag>
  );
}
