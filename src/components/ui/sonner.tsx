'use client';

import { Toaster as SonnerToaster } from 'sonner';

const Toaster = () => {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            'group border-border bg-background text-foreground shadow-lg rounded-md',
          description: 'text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-muted text-muted-foreground',
        },
      }}
    />
  );
};

export { Toaster };
