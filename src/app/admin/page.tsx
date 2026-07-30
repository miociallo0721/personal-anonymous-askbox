import { redirect } from "next/navigation";

import { AdminDashboard } from "@/components/admin-dashboard";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "管理后台" };

type Props = { searchParams: Promise<{ question?: string }> };

export default async function AdminPage({ searchParams }: Props) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const parsedQuestionId = Number((await searchParams).question);
  const initialQuestionId =
    Number.isSafeInteger(parsedQuestionId) && parsedQuestionId > 0 ? parsedQuestionId : undefined;
  return <AdminDashboard initialQuestionId={initialQuestionId} />;
}
