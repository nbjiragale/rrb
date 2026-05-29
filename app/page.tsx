import { redirect } from "next/navigation";

export default function Home() {
  // The daily review loop is the core of v1 — land there.
  redirect("/review");
}
