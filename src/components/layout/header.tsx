/**
 * Header Component
 * Page header with title and actions
 */

export function Header({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="border-b bg-background">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{title}</h1>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      </div>
    </header>
  );
}
