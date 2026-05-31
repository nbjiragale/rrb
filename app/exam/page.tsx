import { getExamConfig } from "@/lib/db/queries/examConfig";
import { ExamConfigForm } from "@/components/exam/ExamConfigForm";

export const dynamic = "force-dynamic";

// Exam parameterisation (CLAUDE.md §5) — sections, negative marking, exam date.
// Read by mocks, the planner backstop, the EV trainer, and readiness.
export default async function ExamPage() {
  const config = await getExamConfig();

  return (
    <div className="mx-auto max-w-shell px-6 py-8 md:px-8">
      <h1 className="text-h1 mb-2">Exam setup</h1>
      <p className="text-secondary text-body mb-6">
        Define your exam&apos;s sections, negative marking, and date. Mocks, the study planner, and
        your readiness estimate all read this.
      </p>
      <ExamConfigForm config={config} />
    </div>
  );
}
