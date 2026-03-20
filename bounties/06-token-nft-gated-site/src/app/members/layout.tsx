import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth/get-session";
import { checkPathAccess } from "@/lib/gating/access";

export default async function MembersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/members");

  const pathname =
    (await headers()).get("x-pathname") ?? "/members";

  const gate = await checkPathAccess(pathname, session.address, {});
  if (!gate.allowed) {
    redirect("/unauthorized");
  }

  return <>{children}</>;
}
