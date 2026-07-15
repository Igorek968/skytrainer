import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { absoluteUrl, pageMetadata } from "@/lib/seo";
import { breadcrumbJsonLd, reviewJsonLd } from "@/lib/seo-schema";
import { effectivePhotoGallery } from "@/lib/instructor-profile-photo-draft";
import {
  canonicalizeActivityLabels,
  repairStaleCatalogSyntheticBio,
  resolveInstructorListAvatar,
} from "@/lib/services/instructor-match";

type Props = { params: Promise<{ id: string }> };

async function loadApprovedInstructor(id: string) {
  return prisma.user.findFirst({
    where: {
      id,
      role: "INSTRUCTOR",
      instructorProfile: { is: { verificationStatus: "APPROVED" } },
    },
    include: { instructorProfile: true },
  });
}

function publicImageUrl(src: string | null | undefined): string | undefined {
  if (!src) return undefined;
  if (/^https?:\/\//i.test(src)) return src;
  return absoluteUrl(src.startsWith("/") ? src : `/${src}`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const instructor = await loadApprovedInstructor(id);
  if (!instructor?.instructorProfile) {
    return { title: "Инструктор не найден | ТвойТренер.рф" };
  }
  const specs = canonicalizeActivityLabels(instructor.instructorProfile.specializations);
  const sports = specs.slice(0, 3).join(", ") || "персональные тренировки";
  const name = instructor.name || "Инструктор";
  return pageMetadata({
    title: `${name} — инструктор (${sports}) | ТвойТренер.рф`,
    description: `Профиль инструктора ${name} на ТвойТренер.рф: ${sports}. Рейтинг ${instructor.instructorProfile.ratingAvg.toFixed(1)}, отзывов ${instructor.instructorProfile.reviewCount}. Ставка от ${Number(instructor.instructorProfile.hourlyRate).toLocaleString("ru-RU")} ₽/час. Запись и оплата онлайн.`,
    path: `/instructors/${id}`,
  });
}

export default async function InstructorProfilePage({ params }: Props) {
  const { id } = await params;
  const instructor = await loadApprovedInstructor(id);
  if (!instructor?.instructorProfile) notFound();

  const p = instructor.instructorProfile;
  const specs = canonicalizeActivityLabels(p.specializations);
  const bio = repairStaleCatalogSyntheticBio(p.bio, specs);
  const photos = effectivePhotoGallery(p, instructor.name);
  const photoUrl = resolveInstructorListAvatar({
    photoUrl: photos.photoUrl,
    photoGallery: photos.photoGallery,
    userImage: instructor.image,
  });
  const name = instructor.name || "Инструктор";
  const origin = absoluteUrl(`/instructors/${id}`);

  const recentReviews = await prisma.order.findMany({
    where: {
      instructorId: id,
      status: "COMPLETED",
      clientRating: { not: null },
    },
    select: {
      id: true,
      createdAt: true,
      clientRating: true,
      clientReview: true,
      client: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const personLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    url: origin,
    image: publicImageUrl(photoUrl),
    jobTitle: "Инструктор",
    description: bio || undefined,
    knowsAbout: specs.length ? specs : undefined,
    aggregateRating:
      p.reviewCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: Number(p.ratingAvg.toFixed(1)),
            reviewCount: p.reviewCount,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
  };

  const schemas: Record<string, unknown>[] = [
    breadcrumbJsonLd([
      { name: "ТвойТренер.рф", path: "/" },
      { name: name, path: `/instructors/${id}` },
    ]),
    personLd,
    ...recentReviews
      .filter((r) => r.clientRating != null)
      .map((r) =>
        reviewJsonLd({
          itemName: name,
          itemUrl: `/instructors/${id}`,
          ratingValue: r.clientRating!,
          reviewBody: r.clientReview,
          authorName: r.client.name,
          datePublished: r.createdAt,
        }),
      ),
  ];

  return (
    <article className="mx-auto max-w-3xl space-y-6 py-2">
      {schemas.map((schema, i) => (
        <script
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <nav aria-label="Хлебные крошки" className="text-sm text-muted-foreground">
        <Link href="/" className="underline-offset-2 hover:underline">
          ТвойТренер.рф
        </Link>
        {" · "}
        Инструктор
      </nav>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={name}
            width={120}
            height={120}
            className="h-[120px] w-[120px] rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-[120px] w-[120px] items-center justify-center rounded-xl bg-muted text-2xl font-semibold">
            {name.slice(0, 1)}
          </div>
        )}
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{name}</h1>
          <p className="text-muted-foreground">
            Рейтинг {p.ratingAvg.toFixed(1)} · {p.reviewCount} отзывов
            {p.experienceYears != null ? ` · опыт ${p.experienceYears} лет` : ""}
          </p>
          {specs.length > 0 ? (
            <p className="text-sm">
              <span className="font-medium">Направления: </span>
              {specs.join(", ")}
            </p>
          ) : null}
          <p className="text-sm">Ставка от {Number(p.hourlyRate).toLocaleString("ru-RU")} ₽/час</p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href="/"
              className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Найти на карте
            </Link>
            <Link href={`/instructors/${id}/reviews`} className="text-sm text-primary underline-offset-2 hover:underline">
              Все отзывы
            </Link>
          </div>
        </div>
      </header>
      {bio ? (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">О себе</h2>
          <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{bio}</p>
        </section>
      ) : null}
      {recentReviews.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Недавние отзывы</h2>
          <ul className="space-y-3">
            {recentReviews.map((r) => (
              <li key={r.id} className="rounded-lg border border-border/60 p-3 text-sm">
                <p className="font-medium">
                  ★ {r.clientRating ?? "—"} · {r.client.name || "Ученик"}
                </p>
                {r.clientReview ? (
                  <p className="mt-1 text-muted-foreground">{r.clientReview}</p>
                ) : null}
              </li>
            ))}
          </ul>
          <Link
            href={`/instructors/${id}/reviews`}
            className="text-sm text-primary underline-offset-2 hover:underline"
          >
            Смотреть все отзывы
          </Link>
        </section>
      ) : null}
    </article>
  );
}
