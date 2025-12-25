import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Upsert user to ensure existence without crashing on duplicate unique constraint
  const user = await prisma.user.upsert({
    where: { username: "swify_user" },
    update: {},
    create: {
      username: "swify_user",
      password: "password123",
    },
  });
  console.log("Seeded user:", user);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
