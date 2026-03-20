import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";

export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/profile");
  return <>{children}</>;
}
