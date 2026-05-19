"use client";

import Daily from "@/components/Daily";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";

export default function DailyPage() {
  return (
    <>
      <ModuleHeader title="Tarefas" backTo="/" />
      <Daily />
      <Navigation />
    </>
  );
}
