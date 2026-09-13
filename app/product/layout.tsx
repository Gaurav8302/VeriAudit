import { AppShell } from "@/components/product/AppShell";
import { WorkspaceProvider } from "@/components/product/WorkspaceProvider";

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
