import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { ShareCardGenerator } from "@/components/share-card-generator";
import { db } from "@/db/client";
import { questions } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";
import { idSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const metadata = { title: "分享卡片" };

type Props = { params: Promise<{ id: string }> };

export default async function ShareCardPage({ params }: Props) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();

  const question = db
    .select({
      id: questions.id,
      content: questions.content,
      status: questions.status,
    })
    .from(questions)
    .where(eq(questions.id, id.data))
    .get();
  if (!question || question.status !== "replied") notFound();

  return (
    <main className="mx-auto min-h-dvh max-w-6xl px-5 py-5 sm:px-8 sm:py-7 lg:px-10">
      <header className="rule-subtle flex flex-wrap items-end justify-between gap-5 border-b pb-5">
        <div>
          <p className="eyebrow">ASKBOX ADMIN</p>
          <h1 className="type-heading mt-4">分享卡片</h1>
        </div>
        <a href={`/admin?question=${question.id}`} className="button-secondary no-underline">
          返回问题管理
        </a>
      </header>

      <ShareCardGenerator question={{ id: question.id, content: question.content }} />
    </main>
  );
}
