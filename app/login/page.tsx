import type { Metadata } from "next";
import LoginPageView from "@/src/features/auth/components/LoginPageView";

export const metadata: Metadata = {
  title: "Login | Interactive Blog",
  description: "Compass-based ritual login for the interactive blog.",
};

export default function LoginPage() {
  return <LoginPageView />;
}
