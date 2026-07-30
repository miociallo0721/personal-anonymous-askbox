import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin-login-form";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) redirect("/admin");
  return (
    <main className="min-h-dvh px-5 py-5 sm:px-8 sm:py-7 lg:px-12">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-[68rem] flex-col sm:min-h-[calc(100dvh-3.5rem)]">
        <header className="rule-subtle flex items-center justify-between border-b pb-3">
          <p className="font-editorial text-[15px] tracking-[-0.01em] text-[var(--foreground)]">
            ASKBOX ADMIN
          </p>
          <span className="h-px w-5 bg-[var(--accent)] opacity-80" aria-hidden="true" />
        </header>

        <section className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-md">
            <div className="mb-8 max-w-sm">
              <h1 className="type-heading">管理员登录</h1>
              <p className="type-body mt-4">请输入环境变量中配置的管理员密码。</p>
            </div>
            <div className="surface p-5 sm:p-8">
              <AdminLoginForm />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
