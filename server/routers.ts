import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { buildCAPXML } from "./cap/builder";
import { validateCAP } from "./cap/validator";
import { parseCAP } from "./cap/parser";
import {
  insertCapMessage, getCapMessagesByUser, getCapMessageById, deleteCapMessage,
} from "./db";
import {
  StatusValues, MsgTypeValues, ScopeValues, CategoryValues,
  UrgencyValues, SeverityValues, CertaintyValues, ResponseTypeValues,
} from "./cap/types";
import { nanoid } from "nanoid";

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const CAPAreaSchema = z.object({
  areaDesc: z.string().min(1),
  polygon: z.string().optional(),
  circle: z.string().optional(),
  geocode: z.record(z.string(), z.string()).optional(),
  altitude: z.number().optional(),
  ceiling: z.number().optional(),
});

const CAPResourceSchema = z.object({
  resourceDesc: z.string().min(1),
  mimeType: z.string().min(1),
  uri: z.string().optional(),
  size: z.number().optional(),
  digest: z.string().optional(),
});

const CAPInfoSchema = z.object({
  language: z.string().default("en-SG"),
  category: z.enum(CategoryValues),
  event: z.string().min(1),
  urgency: z.enum(UrgencyValues),
  severity: z.enum(SeverityValues),
  certainty: z.enum(CertaintyValues),
  headline: z.string().min(1),
  expires: z.string().min(1),
  description: z.string().optional(),
  instruction: z.string().optional(),
  effective: z.string().optional(),
  onset: z.string().optional(),
  senderName: z.string().optional(),
  responseType: z.enum(ResponseTypeValues).optional(),
  eventCodes: z.record(z.string(), z.string()).optional(),
  parameters: z.record(z.string(), z.string()).optional(),
  areas: z.array(CAPAreaSchema).optional().default([]),
  resources: z.array(CAPResourceSchema).optional().default([]),
});

const CAPMessageSchema = z.object({
  identifier: z.string().optional(),
  sender: z.string().min(1, "Sender is required"),
  sent: z.string().optional(),
  status: z.enum(StatusValues),
  msgType: z.enum(MsgTypeValues),
  scope: z.enum(ScopeValues),
  restriction: z.string().optional(),
  addresses: z.string().optional(),
  note: z.string().optional(),
  references: z.string().optional(),
  incidents: z.string().optional(),
  infoBlocks: z.array(CAPInfoSchema).min(0),
});

// ─── CAP router ───────────────────────────────────────────────────────────────

const capRouter = router({
  // Build + validate + save in one shot
  compose: protectedProcedure
    .input(CAPMessageSchema)
    .mutation(async ({ input, ctx }) => {
      const msg = {
        ...input,
        identifier: input.identifier || nanoid(),
        sent: input.sent || new Date().toISOString(),
        infoBlocks: input.infoBlocks.map((info) => ({
          ...info,
          eventCodes: info.eventCodes as Record<string, string> | undefined,
          parameters: info.parameters as Record<string, string> | undefined,
        })),
      };

      let xml: string;
      try {
        xml = buildCAPXML(msg);
      } catch (e) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: e instanceof Error ? e.message : String(e),
        });
      }

      const summary = validateCAP(xml);

      // Save to history
      const severity = msg.infoBlocks[0]?.severity;
      await insertCapMessage({
        userId: ctx.user.id,
        type: "composed",
        identifier: msg.identifier,
        sender: msg.sender,
        status: msg.status,
        severity: severity,
        msgType: msg.msgType,
        xml,
      });

      return { xml, summary, identifier: msg.identifier };
    }),

  // Validate only (no save)
  validate: publicProcedure
    .input(z.object({ xml: z.string() }))
    .mutation(({ input }) => {
      return validateCAP(input.xml);
    }),

  // Parse raw XML
  parse: protectedProcedure
    .input(z.object({ xml: z.string() }))
    .mutation(async ({ input, ctx }) => {
      let parsed;
      try {
        parsed = parseCAP(input.xml);
      } catch (e) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: e instanceof Error ? e.message : String(e),
        });
      }

      const summary = validateCAP(input.xml);

      // Save to history
      const severity = parsed.infoBlocks[0]?.severity;
      await insertCapMessage({
        userId: ctx.user.id,
        type: "parsed",
        identifier: parsed.identifier,
        sender: parsed.sender,
        status: parsed.status,
        severity,
        msgType: parsed.msgType,
        xml: input.xml,
      });

      return { parsed, summary };
    }),
});

// ─── History router ───────────────────────────────────────────────────────────

const historyRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getCapMessagesByUser(ctx.user.id);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const msg = await getCapMessageById(input.id, ctx.user.id);
      if (!msg) throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      return msg;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await deleteCapMessage(input.id, ctx.user.id);
      return { success: true };
    }),
});

// ─── App router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  cap: capRouter,
  history: historyRouter,
});

export type AppRouter = typeof appRouter;
