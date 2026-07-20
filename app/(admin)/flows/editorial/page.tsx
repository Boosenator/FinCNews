import AdminNav from "../_components/AdminNav";
import EditorialShell from "../_components/EditorialShell";

export const dynamic = "force-dynamic";

export default function EditorialPage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <AdminNav />
      <EditorialShell />
    </div>
  );
}
