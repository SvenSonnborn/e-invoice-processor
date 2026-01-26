/**
 * Navigation Component
 * Main navigation bar for the application
 */

export function Nav() {
  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">E-Rechnung</div>
          <div className="flex gap-4">
            {/* Navigation items will be added here */}
          </div>
        </div>
      </div>
    </nav>
  );
}
