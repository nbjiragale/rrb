"use server";

import { revalidatePath } from "next/cache";
import { generateTodayPlan } from "@/lib/services/planner";

// I1/I3 — (re)generate today's plan; lowEnergy switches to reviews-only.
export async function generatePlan(formData: FormData): Promise<void> {
  const lowEnergy = formData.get("lowEnergy") === "1";
  await generateTodayPlan({ lowEnergy });
  revalidatePath("/planner");
}
