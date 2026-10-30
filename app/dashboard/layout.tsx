import { redirect } from "next/navigation";
import { getSession } from "@/src/lib/auth";

export const instant = false;

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  if (!session) {
    redirect("/student/login");
  }

  if (session.role === "Student") {
    redirect("/student");
  }

  return children;
}
