import type { InferResponseType } from "hono/client";
import type { api } from "./api";

// Response shapes, read straight off the API routes.
type Organizer = typeof api.api.organizer.events;
type OneEvent = (typeof api.api.organizer.events)[":id"];

export type OrganizerEventRow = InferResponseType<Organizer["$get"], 200>["events"][number];
export type OrganizerEvent = InferResponseType<OneEvent["$get"], 200>["event"];
export type EventStats = InferResponseType<OneEvent["stats"]["$get"], 200>["stats"];
export type Attendee = InferResponseType<OneEvent["attendees"]["$get"], 200>["attendees"][number];
export type RecentCheckIn = InferResponseType<OneEvent["check-ins"]["$get"], 200>["recent"][number];
export type CheckInResult = InferResponseType<OneEvent["check-ins"]["$post"], 200>;
export type SentMessage = InferResponseType<OneEvent["announcements"]["$get"], 200>["messages"][number];
