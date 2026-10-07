# Socialhub Realtime & Push Foundation

## Scope

This phase establishes a shared recipient-scoped event stream, Android presence, and consent-based push-device registration without requiring a vendor-specific realtime provider.

## Event flow

1. A server mutation creates a domain object such as a message.
2. The mutation publishes a RealtimeEvent for each authorized conversation member.
3. Web clients can consume the same event contract in a future realtime adapter.
4. Android consumes /api/realtime through one app-level cursor poll instead of polling every conversation independently.
5. Push devices are stored separately so background notification delivery can be added without changing the messaging API.

## Security model

- Events are stored with an explicit recipientId.
- Conversation events are created only for current conversation members.
- The realtime API only queries the authenticated user's events.
- Presence is controlled by the showActiveStatus privacy setting.
- Android push permission is never requested during app boot; the user enables it from Settings.
- Push tokens can only be removed by the authenticated owner of that token.

## Current event

message.created

Payload contains the authorized message representation and the conversation ID. Additional event types should use the same recipient-scoped contract.

## Future transport

The event storage/API is intentionally separated from transport. A WebSocket or managed realtime provider can replace the Android fallback poll and web polling later without changing the domain event contract.

## Retention

Realtime events are transient synchronization data. Add scheduled cleanup of events older than the chosen retention window before large-scale production traffic.

## Android notification behavior

Android uses expo-notifications. Remote notification delivery requires a development/release build rather than Expo Go for remote notifications. The first implementation stores the native Android push token and notification preferences; server-side FCM delivery is the next push sub-phase.