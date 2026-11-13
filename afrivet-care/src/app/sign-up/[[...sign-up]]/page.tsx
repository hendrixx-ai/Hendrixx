import { SignUp } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { getConfig } from "@/lib/config";

export default function Page() {
  // Without Clerk keys there is no sign-in; the app runs in demo mode.
  if (!getConfig().clerk) redirect("/");
  return (
    <div className="auth">
      <SignUp />
    </div>
  );
}
