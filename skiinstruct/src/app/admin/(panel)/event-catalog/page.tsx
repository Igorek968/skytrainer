"use client";

import { AdminWorkspace } from "@/features/admin/admin-workspace";
import { AdminEventCatalogSection } from "@/features/admin/sections/admin-event-catalog";

export default function AdminEventCatalogPage() {
  return (
    <AdminWorkspace
      title="Каталог событий"
      subtitle="Одно событие в ленте — несколько инструкторов. Снятие с публикации скрывает карточку у клиентов."
    >
      {() => <AdminEventCatalogSection />}
    </AdminWorkspace>
  );
}
