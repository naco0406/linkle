import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn.js';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-lg font-semibold tracking-tight',
    'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out',
    'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    // Subtle press feedback. `active:` triggers on click-hold (mouse + touch).
    'active:translate-y-[0.5px] active:duration-75',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: [
          'bg-linkle text-linkle-foreground',
          'shadow-[0_1px_2px_rgba(26,34,54,0.08),0_4px_12px_rgba(51,102,204,0.2)]',
          'hover:bg-linkle/92 hover:shadow-[0_2px_4px_rgba(26,34,54,0.1),0_8px_20px_rgba(51,102,204,0.25)]',
          'active:bg-linkle',
        ].join(' '),
        secondary: 'bg-accent text-accent-foreground hover:bg-accent/80',
        outline: [
          'border-border bg-card text-foreground border',
          'hover:border-foreground/25 hover:bg-muted/60',
        ].join(' '),
        ghost: 'text-foreground hover:bg-muted',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link: 'text-linkle underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3 text-sm [&_svg]:size-4',
        md: 'h-11 px-4 text-base [&_svg]:size-5',
        lg: 'h-12 px-6 text-base [&_svg]:size-5',
        icon: 'size-11 [&_svg]:size-5',
      },
      block: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      block: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, asChild = false, type = 'button', ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...(asChild ? {} : { type })}
      {...props}
    />
  );
});

export { buttonVariants };
