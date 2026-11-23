/**
 * Builds a per-request Rescope MCP server with create_preview_survey.
 */
import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { createSurveyFromIntegration } from '../survey/import/createFromIntegration.js'

const codeRegex = /^[A-Za-z][A-Za-z0-9_]{0,63}$/

const optionSchema = z.object({
  code: z.string().regex(codeRegex).describe('Stable option code, e.g. Q1_O1'),
  text: z.string().min(1).describe('Option label'),
  terminates: z.boolean().optional().describe('True for screen-out / terminate options'),
  isExclusive: z.boolean().optional(),
})

const itemSchema = z.object({
  code: z.string().regex(codeRegex).describe('Stable item code, e.g. Q1'),
  itemType: z.enum(['question', 'page_break', 'text_block', 'group', 'termination_block']),
  questionType: z.string().optional().describe(
    'Builder type key: single_select, multi_select, open_text, dropdown, etc.',
  ),
  text: z.string().optional().describe('Question stem'),
  required: z.boolean().optional(),
  multiline: z.boolean().optional(),
  options: z.array(optionSchema).optional(),
  title: z.string().optional(),
  content: z.string().optional(),
})

const createPreviewInputSchema = {
  title: z.string().min(1).describe('Survey title shown in Rescope'),
  items: z.array(itemSchema).min(1).describe('Ordered survey items (schemaVersion 1)'),
  externalId: z.string().max(200).optional().describe(
    'Idempotency key; repeating the same id returns the same surveyId',
  ),
  surveyCode: z.string().optional().describe('Optional short survey code'),
  description: z.string().optional(),
  internalName: z.string().optional(),
  clientName: z.string().optional(),
  topicName: z.string().optional(),
  surveyTypeName: z.string().optional(),
}

const TOOL_DESCRIPTION = `Create a Rescope survey in pending_review (preview) mode from a structured screening/research brief.

Convert the user's freeform brief into Rescope import schemaVersion 1:
- Use codes like Q1, Q1_O1 (not database UUIDs).
- Choice questions (single_select, multi_select, dropdown) need options[].
- Mark screen-out answers with terminates: true on the option.
- Never set status to live — surveys are always pending_review until a human reviews in the Builder.
- Prefer itemType "question" with questionType keys used by the Builder (single_select, multi_select, open_text, dropdown, matrix, maxdiff, etc.).

Returns surveyId, status pending_review, builderUrl, and any warnings.`

/**
 * @param {{
 *   prisma: import('@prisma/client').PrismaClient,
 *   organizationId: string,
 *   createdById: string | null,
 *   appUrl: string,
 *   cache?: unknown,
 * }} ctx
 */
export function buildRescopeMcpServer(ctx) {
  const server = new McpServer({
    name: 'rescope',
    version: '1.0.0',
  })

  server.registerTool(
    'create_preview_survey',
    {
      description: TOOL_DESCRIPTION,
      inputSchema: createPreviewInputSchema,
    },
    async (args) => {
      const payload = {
        schemaVersion: 1,
        externalId: args.externalId,
        survey: {
          title: args.title,
          surveyCode: args.surveyCode,
          description: args.description,
          internalName: args.internalName,
          clientName: args.clientName,
          topicName: args.topicName,
          surveyTypeName: args.surveyTypeName,
          status: 'pending_review',
        },
        items: args.items,
      }

      const result = await createSurveyFromIntegration(
        ctx.prisma,
        {
          organizationId: ctx.organizationId,
          createdById: ctx.createdById,
        },
        payload,
        { source: 'mcp', cache: ctx.cache },
      )

      if (!result.ok) {
        const detail = result.errors?.length
          ? JSON.stringify(result.errors, null, 2)
          : (result.error || 'Import failed')
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Failed to create preview survey (${result.httpStatus || 422}):\n${detail}`,
          }],
        }
      }

      const builderUrl = `${String(ctx.appUrl).replace(/\/+$/, '')}/#/builder/${result.surveyId}`
      const body = {
        ok: true,
        surveyId: result.surveyId,
        status: result.status || 'pending_review',
        builderUrl,
        revision: result.revision,
        warnings: result.warnings || [],
        idempotent: Boolean(result.idempotent),
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(body, null, 2),
        }],
      }
    },
  )

  return server
}
