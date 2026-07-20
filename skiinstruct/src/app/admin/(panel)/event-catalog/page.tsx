"use client";

import { AdminEventCatalogSection } from "@/features/admin/sections/admin-event-catalog";

export default function AdminEventCatalogPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Каталог мероприятий</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Одно событие в ленте — несколько инструкторов. Снятие с публикации скрывает карточку у
          клиентов.
        </p>
      </div>
      <AdminEventCatalogSection />
    </div>
  );
}
