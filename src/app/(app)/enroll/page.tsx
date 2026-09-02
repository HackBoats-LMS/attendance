import { redirect } from "next/navigation";
import { getMe } from "@/features/auth/actions";
import EnrollmentCamera from "@/features/enrollment/components/EnrollmentCamera";

export default async function EnrollPage() {
  const res = await getMe();

  // Redirect away if already enrolled — no direct URL access either
  if ("user" in res && res.user?.hasFaceEmbedding) {
    redirect("/dashboard");
  }

  return <EnrollmentCamera />;
}
