import { backfillAllInstructorProfiles } from "../src/lib/instructor-profile-defaults";
import { prisma } from "../src/lib/prisma";

async function main() {
  const result = await backfillAllInstructorProfiles();
  console.log("Instructor profile backfill OK", result);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
