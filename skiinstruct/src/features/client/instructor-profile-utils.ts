import type { ClientInstructorListItem, ClientInstructorProfileInstructor } from "@/features/client/instructor-profile-types";

function firstNonEmptyGalleryUrl(urls: string[] | undefined | null): string | null {
  const hit = urls?.find((u) => typeof u === "string" && u.trim().length > 0);
  return hit?.trim() ?? null;
}

export function instructorListAvatar(
  row: Pick<ClientInstructorListItem, "photoUrl" | "image">,
): string | null {
  const p = row.photoUrl?.trim();
  const img = row.image?.trim();
  return (p && p.length > 0 ? p : null) ?? (img && img.length > 0 ? img : null);
}

export function instructorExpandedAvatar(ins: ClientInstructorProfileInstructor): string | null {
  return (
    (ins.profile.photoUrl?.trim() || null) ??
    firstNonEmptyGalleryUrl(ins.profile.photoGallery) ??
    (ins.image?.trim() || null)
  );
}
