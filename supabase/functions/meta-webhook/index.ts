// Supabase Edge Function: meta-webhook
// Release 5: Instagram Real Message Ingestion
// Handles Meta Graph API Webhooks exclusively for Instagram Direct Ingestion

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServerSupabaseClient } from "../_shared/supabaseServer.ts";
import { createErrorResponse, createSuccessResponse } from "../_shared/errors.ts";
import { logSecure } from "../_shared/logger.ts";
import { isEventProcessed } from "../_shared/idempotency.ts";

const VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || Deno.env.get("WEBHOOK_VERIFY_TOKEN");
const META_APP_SECRET = Deno.env.get("META_APP_SECRET");

/**
 * Validates Meta x-hub-signature-256 HMAC-SHA256
 */
async function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }
  try {
    const expectedSignature = signatureHeader.slice(7);
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(appSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(rawBody)
    );
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const computedHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return computedHex.toLowerCase() === expectedSignature.toLowerCase();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logSecure("error", {
      service: "meta-webhook",
      action: "verify_signature",
      status: "error",
      message: `Signature verification exception: ${msg}`,
    });
    return false;
  }
}

serve(async (req: Request) => {
  const startTime = Date.now();

  // 1. CORS Pre-flight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);

  // 2. Meta Webhook Verification Handshake (GET)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (!mode || !token) {
      logSecure("warn", {
        service: "meta-webhook",
        action: "verify_handshake",
        status: "warning",
        message: "Missing hub.mode or hub.verify_token parameter",
      });
      return createErrorResponse(400, "Missing verification parameters", "INVALID_INPUT");
    }

    if (mode === "subscribe" && VERIFY_TOKEN && token === VERIFY_TOKEN) {
      logSecure("info", {
        service: "meta-webhook",
        action: "verify_handshake",
        status: "success",
        message: "Meta webhook handshake verified successfully for Instagram Direct",
      });
      return new Response(challenge || "", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    logSecure("warn", {
      service: "meta-webhook",
      action: "verify_handshake",
      status: "error",
      message: "Webhook verification failed: token mismatch or unconfigured",
    });
    return createErrorResponse(403, "Verification token mismatch", "FORBIDDEN");
  }

  // 3. Inbound Meta Webhook Ingestion (POST)
  if (req.method === "POST") {
    let rawBody = "";
    try {
      rawBody = await req.text();
    } catch {
      return createErrorResponse(400, "Failed to read request body", "INVALID_INPUT");
    }

    // 3.1 Validate HMAC Signature if META_APP_SECRET is configured
    if (META_APP_SECRET) {
      const signatureHeader = req.headers.get("x-hub-signature-256");
      const isValid = await verifyMetaSignature(rawBody, signatureHeader, META_APP_SECRET);
      if (!isValid) {
        logSecure("warn", {
          service: "meta-webhook",
          action: "validate_signature",
          status: "error",
          message: "Meta Webhook signature validation failed: invalid HMAC-SHA256 signature",
        });
        return createErrorResponse(401, "Invalid webhook signature", "UNAUTHORIZED");
      }
    }

    // 3.2 Parse and validate JSON payload
    let payload: Record<string, any>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return createErrorResponse(400, "Invalid JSON payload", "INVALID_INPUT");
    }

    if (!payload || typeof payload !== "object") {
      return createErrorResponse(400, "Invalid payload structure", "INVALID_INPUT");
    }

    const objectType = payload.object;
    if (objectType !== "instagram" && objectType !== "page") {
      logSecure("info", {
        service: "meta-webhook",
        action: "filter_object_type",
        status: "received",
        message: `Ignored unsupported object type: ${objectType}`,
      });
      // Meta requires 200 acknowledgement for delivery receipts/non-target events
      return createSuccessResponse({ status: "OBJECT_IGNORED", object: objectType }, 200);
    }

    const entries = payload.entry;
    if (!Array.isArray(entries) || entries.length === 0) {
      return createSuccessResponse({ status: "NO_ENTRIES_FOUND" }, 200);
    }

    try {
      const supabase = getServerSupabaseClient();
      let processedCount = 0;
      let duplicateCount = 0;

      for (const entry of entries) {
        const messagingList = entry.messaging || [];
        for (const messaging of messagingList) {
          // Ignore message echoes (sent from the business) to prevent self-looping
          if (messaging.message?.is_echo) {
            continue;
          }

          // Ignore delivery receipts, read receipts, or typing indicators
          if (!messaging.message && !messaging.postback) {
            continue;
          }

          const senderId = messaging.sender?.id;
          const recipientId = messaging.recipient?.id;
          const messageObj = messaging.message || {};
          const rawMessageId = messageObj.mid || `${senderId}_${messaging.timestamp || entry.time || Date.now()}`;
          const externalEventId = rawMessageId;

          if (!senderId) continue;

          // 3.3 Idempotency Check
          const isDuplicate = await isEventProcessed(supabase, externalEventId);
          if (isDuplicate) {
            duplicateCount++;
            logSecure("info", {
              service: "meta-webhook",
              action: "idempotency_check",
              status: "duplicate",
              eventId: externalEventId,
              channel: "instagram",
              message: "Duplicate event detected. Skipped insertion to guarantee idempotency.",
            });
            continue;
          }

          // 3.4 Normalize Message & Content Type (No AI, No Hallucinated Content)
          let contentType = "text";
          let messageContent = messageObj.text || "";
          let mediaUrl: string | null = null;

          if (messageObj.attachments && messageObj.attachments.length > 0) {
            const att = messageObj.attachments[0];
            mediaUrl = att.payload?.url || null;
            if (att.type === "image") {
              contentType = "image";
              messageContent = messageObj.text || "[Imagem recebida]";
            } else if (att.type === "audio") {
              contentType = "audio";
              messageContent = messageObj.text || "[Áudio recebido]";
            } else if (att.type === "video") {
              contentType = "text";
              messageContent = messageObj.text || "[Vídeo recebido]";
            } else if (att.type === "file") {
              contentType = "text";
              messageContent = messageObj.text || "[Arquivo recebido]";
            } else if (att.type === "sticker") {
              contentType = "text";
              messageContent = "[Sticker recebido]";
            } else {
              contentType = "text";
              messageContent = messageObj.text || "[Mídia recebida]";
            }
          }

          if (!messageContent && !mediaUrl) {
            messageContent = "[Mensagem do Instagram Direct]";
          }

          const eventTimestamp = messaging.timestamp
            ? new Date(messaging.timestamp).toISOString()
            : new Date(entry.time || Date.now()).toISOString();

          // 3.5 Contact / Profile Identification & Upsert (No fake names or emails)
          let profileId: string;
          const { data: existingProfiles, error: profileFindErr } = await supabase
            .from("profiles")
            .select("id")
            .eq("channel", "instagram")
            .eq("username", `ig_${senderId}`)
            .limit(1);

          if (profileFindErr) {
            logSecure("warn", {
              service: "meta-webhook",
              action: "find_profile",
              status: "warning",
              message: `Error finding profile: ${profileFindErr.message}`,
            });
          }

          if (existingProfiles && existingProfiles.length > 0) {
            profileId = existingProfiles[0].id;
            // Update last_active_at
            await supabase
              .from("profiles")
              .update({ last_active_at: eventTimestamp })
              .eq("id", profileId);
          } else {
            const { data: newProfile, error: profileInsertErr } = await supabase
              .from("profiles")
              .insert({
                name: `Seguidor IG (${senderId.slice(-4)})`,
                username: `ig_${senderId}`,
                channel: "instagram",
                metadata: {
                  external_id: senderId,
                  platform: "instagram",
                },
                last_active_at: eventTimestamp,
              })
              .select("id")
              .single();

            if (profileInsertErr || !newProfile) {
              logSecure("error", {
                service: "meta-webhook",
                action: "create_profile",
                status: "error",
                message: `Failed to create profile for IG user: ${profileInsertErr?.message}`,
              });
              continue;
            }
            profileId = newProfile.id;
          }

          // 3.6 Conversation Identification & Upsert
          let conversationId: string;
          const { data: existingConversations, error: convFindErr } = await supabase
            .from("conversations")
            .select("id, unread_count")
            .eq("contact_id", profileId)
            .eq("channel", "instagram")
            .limit(1);

          if (convFindErr) {
            logSecure("warn", {
              service: "meta-webhook",
              action: "find_conversation",
              status: "warning",
              message: `Error finding conversation: ${convFindErr.message}`,
            });
          }

          if (existingConversations && existingConversations.length > 0) {
            conversationId = existingConversations[0].id;
            await supabase
              .from("conversations")
              .update({
                updated_at: eventTimestamp,
                unread_count: (existingConversations[0].unread_count || 0) + 1,
              })
              .eq("id", conversationId);
          } else {
            const { data: newConv, error: convInsertErr } = await supabase
              .from("conversations")
              .insert({
                contact_id: profileId,
                channel: "instagram",
                status: "open",
                handler: "human", // Handoff ready: no automated bot response in Release 5
                unread_count: 1,
                metadata: {
                  external_account_id: recipientId,
                  first_event_id: externalEventId,
                },
              })
              .select("id")
              .single();

            if (convInsertErr || !newConv) {
              logSecure("error", {
                service: "meta-webhook",
                action: "create_conversation",
                status: "error",
                message: `Failed to create conversation: ${convInsertErr?.message}`,
              });
              continue;
            }
            conversationId = newConv.id;
          }

          // 3.7 Insert Inbound Message (Sender: 'contact' = Seguidor)
          const { error: msgInsertErr } = await supabase
            .from("messages")
            .insert({
              conversation_id: conversationId,
              sender: "contact",
              channel: "instagram",
              content: messageContent,
              content_type: contentType,
              media_url: mediaUrl,
              status: "delivered",
              external_event_id: externalEventId,
              created_at: eventTimestamp,
              metadata: {
                rawMessageId,
                isStoryReply: Boolean(messageObj.reply_to?.story || messageObj.is_story_reply),
                platform: "instagram_direct",
              },
            });

          if (msgInsertErr) {
            logSecure("error", {
              service: "meta-webhook",
              action: "insert_message",
              status: "error",
              eventId: externalEventId,
              message: `Failed to persist message in PostgreSQL: ${msgInsertErr.message}`,
            });
            continue;
          }

          // 3.8 Update Channel Connection status in database
          await supabase
            .from("channel_connections")
            .update({
              status: "connected",
              status_message: "Webhook ativo e recebendo mensagens do Instagram Direct",
              account_handle: recipientId ? `Conta ID: ${recipientId}` : "Instagram Direct Ativo",
              last_sync_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("channel", "instagram");

          processedCount++;

          logSecure("info", {
            service: "meta-webhook",
            action: "message_ingested",
            status: "success",
            channel: "instagram",
            eventId: externalEventId,
            conversationId,
            message: `Instagram Direct message successfully ingested into Supabase (Release 5).`,
          });
        }
      }

      return createSuccessResponse(
        {
          status: "SUCCESS",
          processedCount,
          duplicateCount,
          durationMs: Date.now() - startTime,
        },
        200
      );
    } catch (dbErr: unknown) {
      const errorMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      logSecure("error", {
        service: "meta-webhook",
        action: "process_payload",
        status: "error",
        durationMs: Date.now() - startTime,
        message: `Database or processing error: ${errorMsg}`,
      });
      return createErrorResponse(500, "Internal webhook processing error", "INTERNAL_ERROR");
    }
  }

  return createErrorResponse(405, "Method not allowed", "METHOD_NOT_ALLOWED");
});

