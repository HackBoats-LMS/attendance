import Navigation from "@/components/layout/Navigation";
import { getMe } from "@/features/auth/actions";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const meRes = await getMe();
  
  if ("error" in meRes || !meRes.user) {
    redirect("/login");
  }

  return (
    <>
      <Navigation initialUser={meRes.user} />
      <main className="flex-1 overflow-y-auto w-full max-w-[100vw] pb-24 md:pb-0">
        {children}
      </main>
    </>
  );
}
