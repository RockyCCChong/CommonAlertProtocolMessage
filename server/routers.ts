import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { buildCAPXML, validateSemantics } from "./cap/builder";
import { validateCAP } from "./cap/validator";
import { parseCAP } from "./cap/parser";
import {
  insertCapMessage, getCapMessagesByUser, getCapMessageById, deleteCapMessage,
  insertFeedRun, getFeedRunsByUser,
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

// ─── Feed router ──────────────────────────────────────────────────────────────

const FEED_TIMEOUT_MS = 20_000;

const feedRouter = router({
  run: protectedProcedure
    .input(
      z.object({
        feedUrl: z.string().url(),
        feedName: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Fetch the feed
      let feedContent: string;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);
        const res = await fetch(input.feedUrl, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        feedContent = await res.text();
      } catch (e) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to fetch feed: ${e instanceof Error ? e.message : String(e)}`,
        });
      }

      // Extract individual CAP messages from the feed
      // Feeds may be Atom/RSS with <entry> blocks containing CAP XML,
      // or a single CAP XML message, or a list of URLs.
      const messages = extractMessagesFromFeed(feedContent);

      let passCount = 0;
      let failCount = 0;
      const errors: Array<{ identifier: string; error: string }> = [];

      for (const { identifier, xml } of messages) {
        try {
          const summary = validateCAP(xml);
          if (summary.valid) {
            passCount++;
          } else {
            failCount++;
            errors.push({ identifier, error: summary.errors.join("; ") });
          }
        } catch (e) {
          failCount++;
          errors.push({ identifier, error: e instanceof Error ? e.message : String(e) });
        }
      }

      const totalCount = messages.length;

      // Save run to DB
      const runId = await insertFeedRun({
        userId: ctx.user.id,
        feedUrl: input.feedUrl,
        feedName: input.feedName,
        totalCount,
        passCount,
        failCount,
        errors: errors.length > 0 ? errors : null,
      });

      return { runId, totalCount, passCount, failCount, errors };
    }),

  history: protectedProcedure.query(async ({ ctx }) => {
    return getFeedRunsByUser(ctx.user.id);
  }),
});

// ─── Feed content extractor ───────────────────────────────────────────────────

function extractMessagesFromFeed(content: string): Array<{ identifier: string; xml: string }> {
  const results: Array<{ identifier: string; xml: string }> = [];

  // Case 1: Direct CAP XML (single alert)
  if (content.includes('urn:oasis:names:tc:emergency:cap:1.2') && content.includes('<alert')) {
    // May contain multiple <alert> blocks
    const alertRe = /<alert[\s\S]*?<\/alert>/gi;
    let m: RegExpExecArray | null;
    while ((m = alertRe.exec(content)) !== null) {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${m[0]}`;
      const idMatch = xml.match(/<identifier[^>]*>([\s\S]*?)<\/identifier>/i);
      const identifier = idMatch ? idMatch[1].trim() : `msg-${results.length + 1}`;
      results.push({ identifier, xml });
    }
    return results;
  }

  // Case 2: Atom/RSS feed — extract <content> or <summary> blocks that contain CAP XML
  const entryRe = /<(?:entry|item)[^>]*>([\s\S]*?)<\/(?:entry|item)>/gi;
  let entryMatch: RegExpExecArray | null;
  while ((entryMatch = entryRe.exec(content)) !== null) {
    const entry = entryMatch[1];
    // Try to find embedded CAP XML in CDATA or direct content
    const capMatch = entry.match(/(<alert[\s\S]*?<\/alert>)/i);
    if (capMatch) {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${capMatch[1]}`;
      const idMatch = xml.match(/<identifier[^>]*>([\s\S]*?)<\/identifier>/i);
      const identifier = idMatch ? idMatch[1].trim() : `entry-${results.length + 1}`;
      results.push({ identifier, xml });
    }
  }

    // Case 3: NOAA/GDACS-style Atom feed with <link> elements pointing to individual CAP XML files
  // Extract all href links that look like CAP XML endpoints
  if (results.length === 0) {
    const linkRe = /href=["']([^"']*(?:cap|alert)[^"']*\.(?:xml|php|cap)[^"']*)["']/gi;
    let linkMatch: RegExpExecArray | null;
    const capLinks: string[] = [];
    while ((linkMatch = linkRe.exec(content)) !== null) {
      const href = linkMatch[1];
      if (!capLinks.includes(href)) capLinks.push(href);
      if (capLinks.length >= 50) break; // safety cap
    }
    // Also try <id> elements in Atom entries that look like CAP URLs
    const idRe = /<id>([^<]*(?:cap|alert)[^<]*)<\/id>/gi;
    let idMatch: RegExpExecArray | null;
    while ((idMatch = idRe.exec(content)) !== null) {
      const href = idMatch[1].trim();
      if (href.startsWith('http') && !capLinks.includes(href)) capLinks.push(href);
      if (capLinks.length >= 50) break;
    }
    // Store link count as metadata for reporting
    if (capLinks.length > 0) {
      // Return a synthetic entry so the UI knows links were found but not fetched
      results.push({
        identifier: `__links_found__:${capLinks.length}`,
        xml: `<!-- ${capLinks.length} linked CAP messages found. Direct URL ingestion requires server-side fetch per link. -->`,
      });
    }
  }

  return results;
}

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
  feed: feedRouter,
});

export type AppRouter = typeof appRouter;
