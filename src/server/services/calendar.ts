import { formatTicketCode } from "@/lib/tickets";

type CalendarEvent = {
  uid: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  description: string;
  url: string;
};

// 20261018T100000Z
const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// Text values escape backslashes, semicolons, commas, and newlines (RFC 5545 3.3.11).
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Lines longer than 75 bytes continue on the next line, which starts with a space.
function fold(line: string) {
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    if (Buffer.byteLength(current + char) > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function toIcs(event: CalendarEvent, now: Date) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Events demo//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(event.startsAt)}`,
    `DTEND:${icsDate(event.endsAt)}`,
    `SUMMARY:${icsText(event.title)}`,
    ...(event.location ? [`LOCATION:${icsText(event.location)}`] : []),
    `DESCRIPTION:${icsText(event.description)}`,
    `URL:${event.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function ticketCalendar(
  ticket: {
    ticketCode: string;
    event: { slug: string; title: string; startsAt: Date; endsAt: Date; isOnline: boolean; location: string | null; city: string };
  },
  baseUrl: string,
  now: Date,
) {
  const { event } = ticket;
  const location = event.isOnline ? event.location : event.location && `${event.location}, ${event.city}`;
  return toIcs(
    {
      uid: `${ticket.ticketCode}@events-demo`,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      location,
      description: `Your ticket: ${formatTicketCode(ticket.ticketCode)}\n${baseUrl}/tickets/${ticket.ticketCode}`,
      url: `${baseUrl}/events/${event.slug}`,
    },
    now,
  );
}
