import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { ShareCardGenerator } from "@/components/share-card-generator";
import { db } from "@/db/client";
import { answers, questions } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";
import { idSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const metadata = { title: "分享卡片" };

type Props = { params: Promise<{ id: string }> };

export default async function ShareCardPage({ params }: Props) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();

  const result = db
    .select({
      question: {
        id: questions.id,
        content: questions.content,
      },
      answer: {
        content: answers.content,
      },
    })
    .from(questions)
    .leftJoin(answers, eq(answers.questionId, questions.id))
    .where(eq(questions.id, id.data))
    .get();
  if (!result) notFound();

  return (
    <main className="mx-auto min-h-dvh max-w-6xl px-5 py-5 sm:px-8 sm:py-7 lg:px-10">
      <header className="rule-subtle flex flex-wrap items-end justify-between gap-5 border-b pb-5">
        <div>
          <p className="eyebrow">ASKBOX ADMIN</p>
          <h1 className="type-heading mt-4">分享卡片</h1>
        </div>
        <a href={`/admin?question=${result.question.id}`} className="button-secondary no-underline">
          返回问题管理
        </a>
      </header>

      <ShareCardGenerator
        question={{
          id: result.question.id,
          content: result.question.content,
          answer: result.answer?.content ?? "",
        }}
      />
    </main>
  );
}
