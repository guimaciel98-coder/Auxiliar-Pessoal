import { redirect } from "next/navigation";
import Hub from "@/components/Hub";

export const metadata = { title: "Daily · Hub" };

export default function Home() {
  if (process.env.NEXT_PUBLIC_FINANCE_ONLY === "true") {
    redirect("/finance/overview");
  }
  return <Hub />;
}
