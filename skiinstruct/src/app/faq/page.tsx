import type { Metadata } from "next";
import Link from "next/link";

import { SEO_PAGES, pageMetadata } from "@/lib/seo";
import { SITE_FAQS, breadcrumbJsonLd, faqPageJsonLd } from "@/lib/seo-schema";

export const metadata: Metadata = pageMetadata(SEO_PAGES.faq);

export default function FaqPage() {
  const schemas = [
    breadcrumbJsonLd([
      { name: "ТвойТренер.рф", path: "/" },
      { name: "FAQ", path: "/faq" },
    ]),
    faqPageJsonLd(SITE_FAQS),
  ];

  return (
    <article className="mx-auto max-w-3xl space-y-8 py-2">
      {schemas.map((schema, i) => (
        <script
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">
          <Link href="/" className="underline-offset-2 hover:underline">
            ТвойТренер.рф
          </Link>
          {" · "}
          FAQ
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Частые вопросы</h1>
        <p className="text-muted-foreground leading-relaxed">
          Краткие ответы о поиске инструктора, оплате через ЮKassa, возвратах и работе сервиса ТвойТренер.рф по всей
          России.
        </p>
      </header>

      <div className="space-y-6">
        {SITE_FAQS.map((f) => (
          <section key={f.question} className="space-y-2">
            <h2 className="text-xl font-semibold">{f.question}</h2>
            <p className="leading-relaxed text-muted-foreground">{f.answer}</p>
          </section>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Нужна помощь по конкретному заказу?{" "}
        <Link href="/support" className="text-primary underline-offset-2 hover:underline">
          Откройте поддержку
        </Link>
        . Гайд:{" "}
        <Link href="/gid/kak-vybrat-instruktora" className="text-primary underline-offset-2 hover:underline">
          как выбрать инструктора
        </Link>
        .
      </p>
    </article>
  );
}
