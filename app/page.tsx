import { redirect } from "next/navigation";
import { getSession } from "@/src/lib/auth";

export const instant = false;

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    redirect("/student/login");
  }

  redirect(session.role === "Student" ? "/student" : "/dashboard");
}
