import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user || (session.user as any)?.role !== "admin") {
    redirect("/chat");
  }

  redirect("/admin/providers");
}
