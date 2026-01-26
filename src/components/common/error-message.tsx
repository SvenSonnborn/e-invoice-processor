/**
 * Error Message Component
 * Reusable error display component
 */

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-md bg-destructive/10 p-4 text-destructive">
      {message}
    </div>
  );
}
