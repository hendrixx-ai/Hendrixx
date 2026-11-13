import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { getConfig } from "@/lib/config";

// Everything is private except sign-in/up, the Clerk webhook (verified by signature)
// and the health check.
const isPublic = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/api/webhooks(.*)", "/api/health"]);

const withClerk = clerkMiddleware(
  async (auth, req) => {
    if (!isPublic(req)) await auth.protect();
  },
  { signInUrl: "/sign-in", signUpUrl: "/sign-up" },
);

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  // Without Clerk keys the app runs in demo mode and there is nothing to protect.
  if (!getConfig().clerk) return NextResponse.next();
  return withClerk(req, event);
}

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:css|js|png|jpg|jpeg|webp|svg|ico|woff2?|webmanifest)).*)", "/(api|trpc)(.*)"],
};
