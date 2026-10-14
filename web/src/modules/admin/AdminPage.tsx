import { Outlet } from "react-router-dom";
import { PlatformActivityPanel } from "./components/PlatformActivityPanel";

export function AdminPage() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl font-semibold text-foreground">Admin</h1>

      <PlatformActivityPanel />

      <Outlet />
    </div>
  );
}
