export async function loadPlatformLists(prisma, organizationId) {
  const [clients, topics, surveyTypes] = await Promise.all([
    prisma.client.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    }),
    prisma.topic.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    }),
    prisma.surveyType.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    }),
  ])
  return { clients, topics, surveyTypes }
}