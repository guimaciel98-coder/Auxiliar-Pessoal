import { HealthProvider } from "@/hooks/useHealth";

export const metadata = { title: "Daily · Saúde" };

export default function HealthLayout({ children }) {
  return (
    <HealthProvider>
      {children}
    </HealthProvider>
  );
}
