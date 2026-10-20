/**
 * One insert beside a mutation that already succeeded.
 * Stores ids only — never answer text, passwords, or tokens.
 */
export async function appendAudit(prisma, event) {
  await prisma.auditEvent.create({
    data: {
      organizationId: event.organizationId ?? null,
      actorId: event.actorId ?? null,
      action: event.action,
      targetEntity: event.targetEntity,
      targetId: event.targetId,
    },
  })
}
