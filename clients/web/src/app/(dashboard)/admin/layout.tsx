import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminNavigation } from "@/components/admin/AdminNavigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="min-h-full bg-background">
        <AdminNavigation />
        <div className="mx-auto w-full max-w-[1440px] p-4 md:p-6">{children}</div>
      </div>
    </AdminGuard>
  );
}
