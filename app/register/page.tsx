import type { Metadata } from "next";
import RegisterPageView from "@/src/features/auth/components/RegisterPageView";

export const metadata: Metadata = {
  title: "Register | Interactive Blog",
  description: "Learn and create your compass-password sequence.",
};

export default function RegisterPage() {
  return <RegisterPageView />;
}
