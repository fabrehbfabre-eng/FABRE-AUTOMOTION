// Supabase Edge Function: whatsapp-webhook
// Release: WhatsApp Real Message Persistence
// Handles WhatsApp Business Cloud API Webhooks with full Supabase PostgreSQL persistence

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServerSupabaseClient } from "../_shared/supabaseServer.ts";
import { createErrorResponse, createSuccessResponse } from "../_shared/errors.ts";
import { logSecure } from "../_shared/logger.ts";
import { isEventProcessed } from "../_shared/idempotency.ts";

const VERIFY_TOKEN =
  Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN") ||
  Deno.env.get("WEBHOOK_VERIFY_TOKEN") ||
  Deno.env.get("META_WEBHOOK_VERIFY_TOKEN");
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
      service: "whatsapp-webhook",
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

  // 2. WhatsApp Webhook Verification Handshake (GET)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (!mode || !token) {
      logSecure("warn", {
        service: "whatsapp-webhook",
        action: "verify_handshake",
        status: "warning",
        message: "Missing hub.mode or hub.verify_token parameter",
      });
      return createErrorResponse(400, "Missing verification parameters", "INVALID_INPUT");
    }

    if (mode === "subscribe" && VERIFY_TOKEN && token === VERIFY_TOKEN) {
      logSecure("info", {
        service: "whatsapp-webhook",
        action: "verify_handshake",
        status: "success",
        message: "WhatsApp webhook handshake verified successfully",
      });
      return new Response(challenge || "", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    logSecure("warn", {
      service: "whatsapp-webhook",
      action: "verify_handshake",
      status: "error",
      message: "WhatsApp verification failed: token mismatch",
    });
    return createErrorResponse(403, "Verification token mismatch", "FORBIDDEN");
  }

  // 3. Inbound WhatsApp Message Ingestion & Persistence (POST)
  if (req.method === "POST") {
    let rawBody = "";
    try {
      rawBody = await req.text();
    } catch {
      return createErrorResponse(400, "Failed to read request body", "INVALID_INPUT");
    }

    // 3.1 Validate HMAC Signature if META_APP_SECRET is configured and header is present
    if (META_APP_SECRET) {
      const signatureHeader = req.headers.get("x-hub-signature-256");
      if (signatureHeader) {
        const isValid = await verifyMetaSignature(rawBody, signatureHeader, META_APP_SECRET);
        if (!isValid) {
          logSecure("warn", {
            service: "whatsapp-webhook",
            action: "validate_signature",
            status: "error",
            message: "WhatsApp webhook signature validation failed: invalid HMAC-SHA256 signature",
          });
          return createErrorResponse(401, "Invalid webhook signature", "UNAUTHORIZED");
        }
      } else {
        logSecure("info", {
          service: "whatsapp-webhook",
          action: "validate_signature",
          status: "received",
          message: "Request without x-hub-signature-256 header. Proceeding with payload processing.",
        });
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

    if (payload.object !== "whatsapp_business_account") {
      logSecure("info", {
        service: "whatsapp-webhook",
        action: "filter_object_type",
        status: "received",
        message: `Ignored unsupported object type: ${payload.object}`,
      });
      return createSuccessResponse({ status: "OBJECT_IGNORED", object: payload.object }, 200);
    }

    const entries = payload.entry;
    if (!Array.isArray(entries) || entries.length === 0) {
      return createSuccessResponse({ status: "NO_ENTRIES_FOUND" }, 200);
    }

    try {
      const supabase = getServerSupabaseClient();
      let processedCount = 0;
      let duplicateCount = 0;
      let statusCount = 0;
      let lastEventId = "";

      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          if (change.field !== "messages") {
            continue;
          }

          const value = change.value;
          if (!value || typeof value !== "object") {
            continue;
          }

          const displayPhoneNumber = value.metadata?.display_phone_number;
          const phoneNumberId = value.metadata?.phone_number_id;
          const contacts = value.contacts || [];

          // Helper to extract official contact name
          const getContactName = (phone: string): string => {
            const match = contacts.find((c: any) => c.wa_id === phone);
            return match?.profile?.name || `WhatsApp (${phone.slice(-4)})`;
          };

          // Track status updates (sent, delivered, read) without creating fake messages
          if (Array.isArray(value.statuses) && value.statuses.length > 0) {
            statusCount += value.statuses.length;
            for (const st of value.statuses) {
              logSecure("info", {
                service: "whatsapp-webhook",
                action: "status_update",
                status: "received",
                channel: "whatsapp",
                eventId: st.id,
                message: `WhatsApp message status update: ${st.status}`,
              });
            }
          }

          const messagesList = value.messages || [];
          for (const message of messagesList) {
            const rawMessageId = message.id;
            const senderPhone = message.from || contacts[0]?.wa_id;
            if (!senderPhone || !rawMessageId) {
              continue;
            }

            const externalEventId = rawMessageId;
            lastEventId = externalEventId;

            // 3.3 Idempotency Check with PostgreSQL
            const isDuplicate = await isEventProcessed(supabase, externalEventId);
            if (isDuplicate) {
              duplicateCount++;
              logSecure("info", {
                service: "whatsapp-webhook",
                action: "idempotency_check",
                status: "duplicate",
                eventId: externalEventId,
                channel: "whatsapp",
                message: "Duplicate WhatsApp event detected. Skipped to guarantee idempotency.",
              });
              continue;
            }

            // 3.4 Content Type & Content Normalization (Strict PostgreSQL CHECK constraint compliance)
            let contentType = "text";
            let textContent = "";
            let mediaUrl: string | null = null;

            const msgType = message.type || "text";

            if (msgType === "text") {
              contentType = "text";
              textContent = message.text?.body || "";
            } else if (msgType === "image") {
              contentType = "image";
              textContent = message.image?.caption || "[Imagem recebida via WhatsApp]";
              mediaUrl = message.image?.id ? `https://graph.facebook.com/v20.0/${message.image.id}` : null;
            } else if (msgType === "audio") {
              contentType = "audio";
              textContent = "[Áudio recebido via WhatsApp]";
              mediaUrl = message.audio?.id ? `https://graph.facebook.com/v20.0/${message.audio.id}` : null;
            } else if (msgType === "interactive") {
              contentType = "quick_reply";
              textContent =
                message.interactive?.button_reply?.title ||
                message.interactive?.list_reply?.title ||
                "[Resposta interativa via WhatsApp]";
            } else if (msgType === "video") {
              // PostgreSQL messages.content_type CHECK allows ('text', 'image', 'audio', 'quick_reply', 'template', 'system_event')
              contentType = "text";
              textContent = message.video?.caption || "[Vídeo recebido via WhatsApp]";
              mediaUrl = message.video?.id ? `https://graph.facebook.com/v20.0/${message.video.id}` : null;
            } else if (msgType === "document") {
              contentType = "text";
              textContent = message.document?.filename
                ? `[Documento: ${message.document.filename}]`
                : "[Documento recebido via WhatsApp]";
            } else if (msgType === "sticker") {
              contentType = "text";
              textContent = "[Figurinha recebida via WhatsApp]";
            } else if (msgType === "location") {
              contentType = "text";
              textContent = message.location?.name
                ? `[Localização: ${message.location.name}]`
                : "[Localização recebida via WhatsApp]";
            } else if (msgType === "reaction") {
              contentType = "text";
              textContent = message.reaction?.emoji
                ? `[Reação: ${message.reaction.emoji}]`
                : "[Reação recebida via WhatsApp]";
            } else {
              contentType = "text";
              textContent = `[Mensagem recebida via WhatsApp (${msgType})]`;
            }

            if (!textContent && !mediaUrl) {
              textContent = "[Mensagem do WhatsApp]";
            }

            const eventTimestamp = message.timestamp
              ? new Date(Number(message.timestamp) * 1000).toISOString()
              : new Date().toISOString();

            // 3.5 Contact / Profile Identification & Upsert (Channel: 'whatsapp')
            let profileId: string;
            const contactName = getContactName(senderPhone);

            const { data: existingProfiles, error: profileFindErr } = await supabase
              .from("profiles")
              .select("id, name")
              .eq("channel", "whatsapp")
              .or(`username.eq.wa_${senderPhone},username.eq.${senderPhone},phone.eq.${senderPhone}`)
              .limit(1);

            if (profileFindErr) {
              logSecure("warn", {
                service: "whatsapp-webhook",
                action: "find_profile",
                status: "warning",
                message: `Error finding WhatsApp profile: ${profileFindErr.message}`,
              });
            }

            if (existingProfiles && existingProfiles.length > 0) {
              profileId = existingProfiles[0].id;
              const updateData: Record<string, any> = {
                last_active_at: eventTimestamp,
              };
              // Update name if current name is placeholder and we now have the official contact name
              if (
                contactName &&
                !contactName.startsWith("WhatsApp (") &&
                existingProfiles[0].name.startsWith("WhatsApp (")
              ) {
                updateData.name = contactName;
              }
              await supabase
                .from("profiles")
                .update(updateData)
                .eq("id", profileId);
            } else {
              const { data: newProfile, error: profileInsertErr } = await supabase
                .from("profiles")
                .insert({
                  name: contactName,
                  username: `wa_${senderPhone}`,
                  phone: senderPhone,
                  channel: "whatsapp",
                  metadata: {
                    wa_id: senderPhone,
                    platform: "whatsapp",
                    phone_number_id: phoneNumberId,
                    display_phone_number: displayPhoneNumber,
                  },
                  last_active_at: eventTimestamp,
                })
                .select("id")
                .single();

              if (profileInsertErr || !newProfile) {
                // Concurrency retry
                const { data: retryProfile } = await supabase
                  .from("profiles")
                  .select("id")
                  .eq("channel", "whatsapp")
                  .or(`username.eq.wa_${senderPhone},phone.eq.${senderPhone}`)
                  .limit(1);

                if (retryProfile && retryProfile.length > 0) {
                  profileId = retryProfile[0].id;
                } else {
                  logSecure("error", {
                    service: "whatsapp-webhook",
                    action: "create_profile",
                    status: "error",
                    message: `Failed to create profile for WhatsApp user: ${profileInsertErr?.message}`,
                  });
                  continue;
                }
              } else {
                profileId = newProfile.id;
              }
            }

            // 3.6 Conversation Identification & Upsert (Channel: 'whatsapp')
            let conversationId: string;
            const { data: existingConversations, error: convFindErr } = await supabase
              .from("conversations")
              .select("id, unread_count")
              .eq("contact_id", profileId)
              .eq("channel", "whatsapp")
              .limit(1);

            if (convFindErr) {
              logSecure("warn", {
                service: "whatsapp-webhook",
                action: "find_conversation",
                status: "warning",
                message: `Error finding WhatsApp conversation: ${convFindErr.message}`,
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
                  channel: "whatsapp",
                  status: "open",
                  handler: "human", // Handoff ready: no automated bot response in this release
                  unread_count: 1,
                  metadata: {
                    phone_number_id: phoneNumberId,
                    display_phone_number: displayPhoneNumber,
                    first_event_id: externalEventId,
                    external_user_id: senderPhone,
                  },
                })
                .select("id")
                .single();

              if (convInsertErr || !newConv) {
                // Concurrency retry
                const { data: retryConv } = await supabase
                  .from("conversations")
                  .select("id")
                  .eq("contact_id", profileId)
                  .eq("channel", "whatsapp")
                  .limit(1);

                if (retryConv && retryConv.length > 0) {
                  conversationId = retryConv[0].id;
                } else {
                  logSecure("error", {
                    service: "whatsapp-webhook",
                    action: "create_conversation",
                    status: "error",
                    message: `Failed to create conversation for WhatsApp user: ${convInsertErr?.message}`,
                  });
                  continue;
                }
              } else {
                conversationId = newConv.id;
              }
            }

            // 3.7 Insert Inbound Message (Sender: 'contact')
            const { error: msgInsertErr } = await supabase
              .from("messages")
              .insert({
                conversation_id: conversationId,
                sender: "contact",
                channel: "whatsapp",
                content: textContent,
                content_type: contentType,
                media_url: mediaUrl,
                status: "delivered",
                external_event_id: externalEventId,
                created_at: eventTimestamp,
                metadata: {
                  wa_message_id: rawMessageId,
                  message_type: msgType,
                  sender_phone: senderPhone,
                  phone_number_id: phoneNumberId,
                  display_phone_number: displayPhoneNumber,
                  raw_type: msgType,
                  platform: "whatsapp_cloud_api",
                },
              });

            if (msgInsertErr) {
              if (msgInsertErr.code === "23505" || msgInsertErr.message?.includes("external_event_id")) {
                duplicateCount++;
                logSecure("info", {
                  service: "whatsapp-webhook",
                  action: "insert_message_duplicate",
                  status: "duplicate",
                  eventId: externalEventId,
                  message: "Duplicate message avoided by database unique constraint.",
                });
                continue;
              }

              logSecure("error", {
                service: "whatsapp-webhook",
                action: "insert_message",
                status: "error",
                eventId: externalEventId,
                message: `Failed to persist WhatsApp message in PostgreSQL: ${msgInsertErr.message}`,
              });
              continue;
            }

            // 3.8 Update Channel Connection status in database
            await supabase
              .from("channel_connections")
              .update({
                status: "connected",
                status_message: "Webhook ativo e recebendo mensagens do WhatsApp",
                account_handle: displayPhoneNumber ? `WhatsApp (${displayPhoneNumber})` : `WhatsApp (${senderPhone})`,
                last_sync_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("channel", "whatsapp");

            processedCount++;

            logSecure("info", {
              service: "whatsapp-webhook",
              action: "message_ingested",
              status: "success",
              channel: "whatsapp",
              eventId: externalEventId,
              conversationId,
              message: "WhatsApp inbound message successfully ingested and persisted into Supabase.",
            });
          }
        }
      }

      if (processedCount > 0) {
        return createSuccessResponse(
          {
            status: "SUCCESS",
            processedCount,
            duplicateCount,
            eventId: lastEventId || undefined,
            durationMs: Date.now() - startTime,
          },
          200
        );
      }

      if (duplicateCount > 0) {
        return createSuccessResponse(
          {
            status: "EVENT_ALREADY_PROCESSED",
            duplicateCount,
            eventId: lastEventId || undefined,
            durationMs: Date.now() - startTime,
          },
          200
        );
      }

      if (statusCount > 0) {
        return createSuccessResponse(
          {
            status: "STATUS_UPDATE_RECEIVED",
            statusCount,
            durationMs: Date.now() - startTime,
          },
          200
        );
      }

      return createSuccessResponse(
        {
          status: "RECEIVED",
          eventId: lastEventId || `${entries[0]?.id || "wa"}_${Date.now()}`,
          durationMs: Date.now() - startTime,
        },
        200
      );
    } catch (dbErr: unknown) {
      const errorMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      logSecure("error", {
        service: "whatsapp-webhook",
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

