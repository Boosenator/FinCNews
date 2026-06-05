import AdminNav from "../_components/AdminNav";
import EmailShell from "../_components/EmailShell";

export const dynamic = "force-dynamic";

export default function EmailPage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <AdminNav />
      <EmailShell />
    </div>
  );
}
