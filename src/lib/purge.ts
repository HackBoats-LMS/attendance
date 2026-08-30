import { prisma } from "./prisma";

export async function executePhotoPurge(retentionDays: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const oldRecords = await prisma.attendance.findMany({
    where: { 
      takenAt: { lt: cutoff }, 
      OR: [
        { photoUrl: { not: null } },
        { checkOutPhotoUrl: { not: null } }
      ]
    },
    select: { id: true },
  });

  let deleted = 0;

  for (const record of oldRecords) {
    await prisma.attendance.update({
      where: { id: record.id },
      data: { 
        photoUrl: null,
        checkOutPhotoUrl: null
      },
    });
    deleted++;
  }

  return { deleted, cutoff };
}
