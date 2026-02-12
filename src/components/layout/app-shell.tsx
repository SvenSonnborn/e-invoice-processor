/**
 * App Shell Component
 * Main application container with layout structure
 */

export function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex flex-col">{children}</div>;
}
