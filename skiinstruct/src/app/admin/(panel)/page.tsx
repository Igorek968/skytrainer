import { redirect } from "next/navigation";

export default function AdminPanelIndexPage() {
  redirect("/admin/metrics");
}
