import { prisma } from "../src/lib/prisma";
import { persistInstructorProfileSlug } from "../src/lib/services/instructor-nickname-uniqueness";

async function main() {
  const users = await prisma.user.findMany({
    where: { role: "INSTRUCTOR", nickname: { not: null } },
    select: { id: true, nickname: true, profileSlug: true },
  });

  let n = 0;
  for (const u of users) {
    if (!u.nickname?.trim()) continue;
    if (u.profileSlug) continue;
    const slug = await persistInstructorProfileSlug(u.id, u.nickname, { allowNumericSuffix: true });
    if (slug) {
      n += 1;
      console.log(u.id, u.nickname, "→", slug);
    }
  }

  console.log(`updated ${n} of ${users.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
