"use client";

import DailyOrchestrator from "@/components/Daily/DailyOrchestrator";
import Navigation from "@/components/ui/Navigation";
import ModuleHeader from "@/components/ui/ModuleHeader";

export default function TomorrowPage() {
  return (
    <>
      <ModuleHeader title="Tarefas" backTo="/" />
      <DailyOrchestrator mode="tomorrow" />
      <Navigation />
    </>
  );
}
