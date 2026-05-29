import { queryOne } from "@/lib/db/client";
import type { ExamConfig } from "@/lib/db/types";

export async function getExamConfig(): Promise<ExamConfig | null> {
  return queryOne<ExamConfig>(`SELECT * FROM exam_config ORDER BY id LIMIT 1`);
}
