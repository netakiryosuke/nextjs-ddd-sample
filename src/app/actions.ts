"use server";

import { signIn, signOut } from "@/auth";

export async function loginAction(redirectTo: string): Promise<void> {
  await signIn("keycloak", { redirectTo });
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/events" });
}
