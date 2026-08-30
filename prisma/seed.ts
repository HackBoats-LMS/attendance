import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = "admin123";
  const passwordHash = await hash(password, 10);

  const owner = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      name: "Admin",
      username: "admin",
      passwordHash,
      jobRole: "Administrator",
      isOwner: true,
      isActive: true,
    },
  });

  console.log("\n========================================");
  console.log("  Owner account created/updated:");
  console.log(`  Username: ${owner.username}`);
  console.log(`  Password: ${password}`);
  console.log("========================================");
  console.log("  ⚠️  CHANGE THIS PASSWORD IMMEDIATELY\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
