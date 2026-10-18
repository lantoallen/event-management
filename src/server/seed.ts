import { sql } from "drizzle-orm";
import { fromLocalInput, manilaDayKey } from "@/lib/time";
import type { Db } from "./db/client";
import { emails, events, registrations, users, type EventCategory } from "./db/schema";
import { templates } from "./services/email";
import { newTicketCode } from "./services/registrations";

// Made-up people and events so the demo looks lived in. Dates are worked out
// from "now", so the events are always coming up no matter when it's reset.

export const DEMO_ACCOUNTS = {
  organizer: { name: "Batangas Builders", email: "demo.organizer@example.com" },
  attendee: { name: "Sam Reyes", email: "demo.attendee@example.com" },
} as const;

const ORGANIZERS = {
  builders: DEMO_ACCOUNTS.organizer,
  run: { name: "Lipa Run Club", email: "hello@liparun.example.com" },
  kape: { name: "Kape at Kanta", email: "bookings@kapeatkanta.example.com" },
  food: { name: "Taal Food Walks", email: "tours@taalfood.example.com" },
  product: { name: "Manila Product Circle", email: "team@productcircle.example.com" },
  sining: { name: "Sining Batangueño", email: "sining@example.com" },
};
type OrgKey = keyof typeof ORGANIZERS;

const FIRST = [
  "Andrea", "Miguel", "Bea", "Paolo", "Kristine", "Carlo", "Jasmine", "Rafael", "Nicole", "Joshua",
  "Patricia", "Mark", "Camille", "Gabriel", "Danica", "Enzo", "Trisha", "Luis", "Angela", "Nathan",
  "Hannah", "Joaquin", "Mika", "Adrian", "Isabel", "Kevin", "Rica", "Marco", "Alyssa", "Daniel",
  "Faye", "Ramon", "Ella", "Vince", "Sofia", "Jerome", "Lianne", "Bryan", "Maxine", "Tomas",
];
const LAST = [
  "Santos", "Reyes", "Cruz", "Bautista", "Garcia", "Mendoza", "Torres", "Villanueva", "Ramos",
  "Aquino", "Castillo", "Navarro", "Dela Cruz", "Gonzales", "Flores", "Marquez", "Panganiban",
  "Atienza", "Macaraig", "Katigbak", "Malabanan", "Comia", "Recto", "Dimaculangan", "Lualhati",
];

type SeedEvent = {
  key: string;
  org: OrgKey;
  title: string;
  summary: string;
  description: string;
  category: EventCategory;
  // Start time as days from today plus a Manila clock time. `soon` means the
  // next 6 PM that's at least an hour away, so there's always one to check in to.
  day?: number;
  at?: string;
  soon?: boolean;
  hours: number;
  location: string;
  city: string;
  isOnline?: boolean;
  capacity: number;
  confirmed: number;
  waitlisted?: number;
  status?: "draft" | "published" | "cancelled";
};

const EVENTS: SeedEvent[] = [
  {
    key: "git",
    org: "builders",
    title: "Intro to Git and GitHub",
    summary: "A hands-on morning for people who keep emailing themselves zip files of their code.",
    description:
      "We'll start from zero: what a commit is, how branches work, and how to open your first pull request. Bring a laptop with Git installed. If you get stuck installing it, come 30 minutes early and we'll help.\n\nBy the end you'll have a repo on GitHub with a README you wrote yourself.",
    category: "tech",
    day: -6,
    at: "09:00",
    hours: 3,
    location: "Lipa City Public Library, 2nd floor",
    city: "Lipa City",
    capacity: 40,
    confirmed: 38,
  },
  {
    key: "today",
    org: "builders",
    title: "Design to code study group",
    summary: "Turn a Figma screen into a working page with other people learning the same thing.",
    description:
      "Each session we pick one screen and build it together, then compare how everyone did it. This week is a pricing page. Any framework is fine. Beginners are welcome, and there's always someone to pair with.",
    category: "tech",
    soon: true,
    at: "18:00",
    hours: 2,
    location: "The Daily Grind Cafe, Ayala Highway",
    city: "Lipa City",
    capacity: 20,
    confirmed: 18,
  },
  {
    key: "api",
    org: "builders",
    title: "Build a REST API in one afternoon",
    summary: "Node, Express, and Postgres from an empty folder to a deployed API.",
    description:
      "We'll build a small API for a to-do app: routes, validation, a real database, and tests. You should be comfortable with basic JavaScript. Seats are limited because the mentors want to look at everyone's code.",
    category: "tech",
    day: 3,
    at: "13:00",
    hours: 4,
    location: "De La Salle Lipa, Sentrum Room 4",
    city: "Lipa City",
    capacity: 30,
    confirmed: 30,
    waitlisted: 6,
  },
  {
    key: "meetup",
    org: "builders",
    title: "Batangas Dev Meetup #12",
    summary: "Two short talks, pizza, and a lot of talking about side projects.",
    description:
      "Talk 1: what we learned shipping a mobile app for a local cooperative.\nTalk 2: getting started with open source when you don't know anyone.\n\nAfter the talks the floor is open. If you want to demo something for five minutes, tell us when you arrive.",
    category: "tech",
    day: 12,
    at: "18:00",
    hours: 3,
    location: "SM City Lipa, Cinema 1 Lobby Events Hall",
    city: "Lipa City",
    capacity: 80,
    confirmed: 47,
  },
  {
    key: "portfolio",
    org: "builders",
    title: "Portfolio review night",
    summary: "Share your portfolio and get honest feedback from developers who hire.",
    description:
      "Each person gets ten minutes: five to show their portfolio, five for feedback. We'll go in the order people registered. Have your link ready and keep your camera on if you can.",
    category: "education",
    day: 20,
    at: "19:30",
    hours: 2,
    location: "https://meet.example.com/portfolio-review",
    city: "Online",
    isOnline: true,
    capacity: 25,
    confirmed: 9,
  },
  {
    key: "draft",
    org: "builders",
    title: "Hackathon prep session",
    summary: "How to pick a problem, split the work, and demo in three minutes.",
    description:
      "For teams joining hackathons this season. We'll go through past winning demos and do a practice pitch at the end.",
    category: "tech",
    day: 35,
    at: "14:00",
    hours: 3,
    location: "Lipa City Public Library, 2nd floor",
    city: "Lipa City",
    capacity: 50,
    confirmed: 0,
    status: "draft",
  },
  {
    key: "fun-run",
    org: "run",
    title: "Sunday 5K fun run",
    summary: "An easy 5K around the city. Walkers are welcome too.",
    description:
      "Assembly is at 5:00 AM at the plaza and the gun starts at 5:30. There are water stations at the 2K and 4K marks. Wear something bright. We end with free taho for everyone who finishes.",
    category: "sports",
    day: 5,
    at: "05:30",
    hours: 2,
    location: "San Sebastian Cathedral Plaza",
    city: "Lipa City",
    capacity: 150,
    confirmed: 112,
  },
  {
    key: "trail",
    org: "run",
    title: "Trail run at Mt. Malarayat",
    summary: "A 12K trail run with about 600 meters of climbing.",
    description:
      "This one is for people who already run 10K comfortably. Trail shoes are strongly recommended. We'll have marshals at every turn and a sweeper at the back. Transport from the city is on your own.",
    category: "sports",
    day: 19,
    at: "05:00",
    hours: 5,
    location: "Malarayat trailhead, Brgy. Talisay",
    city: "Lipa City",
    capacity: 40,
    confirmed: 40,
    waitlisted: 12,
  },
  {
    key: "open-mic",
    org: "kape",
    title: "Open mic night",
    summary: "Sign up for a slot or just come for the coffee and the music.",
    description:
      "Each performer gets two songs or about eight minutes. We have a keyboard, two guitars, and a cajon you can borrow. Slots are given out at the door in the order people arrive.",
    category: "music",
    day: 2,
    at: "19:00",
    hours: 3,
    location: "Kape at Kanta, P. Torres St.",
    city: "Lipa City",
    capacity: 60,
    confirmed: 41,
  },
  {
    key: "covers",
    org: "kape",
    title: "OPM acoustic covers night",
    summary: "Local bands play stripped-down covers of OPM classics.",
    description:
      "Three bands, one hour each. Expect sing-alongs. The kitchen stays open until the last set.",
    category: "music",
    day: 16,
    at: "20:00",
    hours: 3,
    location: "Kape at Kanta, P. Torres St.",
    city: "Lipa City",
    capacity: 50,
    confirmed: 50,
    waitlisted: 4,
  },
  {
    key: "food-walk",
    org: "food",
    title: "Heritage food walk in Taal",
    summary: "Four stops, from tamales to panutsa, through the old town.",
    description:
      "We walk about two kilometers between ancestral houses and family-run kitchens. All tastings are included. Wear comfortable shoes and bring water. Tell us about allergies when you register by replying to the confirmation email.",
    category: "food",
    day: 9,
    at: "08:00",
    hours: 4,
    location: "Taal Basilica steps",
    city: "Taal",
    capacity: 20,
    confirmed: 20,
    waitlisted: 7,
  },
  {
    key: "barako",
    org: "food",
    title: "Lomi and kapeng barako tasting",
    summary: "Compare three lomi houses and learn how barako is roasted.",
    description:
      "A roaster from Lipa walks us through how barako beans are grown and roasted, then we try three bowls of lomi side by side and vote.",
    category: "food",
    day: 26,
    at: "16:00",
    hours: 3,
    location: "Barako Hub, Lipa-Batangas Road",
    city: "Lipa City",
    capacity: 30,
    confirmed: 12,
  },
  {
    key: "small-teams",
    org: "product",
    title: "How small teams ship every week",
    summary: "A product lead and an engineer share how their team of four releases weekly.",
    description:
      "We'll cover planning, code review, and what they cut to keep moving. Questions are taken live at the end. The recording goes to everyone who registers.",
    category: "business",
    day: 7,
    at: "12:00",
    hours: 1,
    location: "https://meet.example.com/small-teams",
    city: "Online",
    isOnline: true,
    capacity: 300,
    confirmed: 146,
  },
  {
    key: "first-job",
    org: "product",
    title: "Career talk: landing your first tech job",
    summary: "Recruiters and new hires talk about what actually got them interviews.",
    description:
      "A panel of two recruiters and three people hired in the last year. They'll go through real résumés (shared with permission) and answer questions. Students and career shifters are welcome.",
    category: "education",
    day: 14,
    at: "15:00",
    hours: 2,
    location: "WeWork Ayala, Makati",
    city: "Makati",
    capacity: 120,
    confirmed: 97,
  },
  {
    key: "watercolor",
    org: "sining",
    title: "Watercolor basics workshop",
    summary: "Learn washes, layering, and how to paint Taal Lake in one sitting.",
    description:
      "All materials are provided. You'll leave with two finished small paintings. No experience needed.",
    category: "arts",
    day: 11,
    at: "09:00",
    hours: 3,
    location: "Sining Studio, Kumintang Ibaba",
    city: "Batangas City",
    capacity: 15,
    confirmed: 15,
    waitlisted: 3,
  },
  {
    key: "mural",
    org: "sining",
    title: "Community mural day",
    summary: "Help paint a 20-meter mural along the river walk.",
    description:
      "The design is already sketched, so you just need to show up and fill in colors. Wear clothes you don't mind ruining. Snacks and paint are on us.",
    category: "community",
    day: 30,
    at: "07:00",
    hours: 6,
    location: "Calumpang River Walk",
    city: "Batangas City",
    capacity: 40,
    confirmed: 8,
  },
  {
    key: "night-market",
    org: "food",
    title: "Night market pop-up",
    summary: "Street food stalls and a small craft fair.",
    description: "Twenty stalls, live music, and a craft fair.",
    category: "food",
    day: 8,
    at: "17:00",
    hours: 5,
    location: "Plaza Mabini",
    city: "Batangas City",
    capacity: 200,
    confirmed: 64,
    status: "cancelled",
  },
];

// What the demo attendee is signed up for, so their tickets page has every state.
const DEMO_ATTENDEE_PLANS: Record<string, "confirmed" | "waitlisted" | "checked_in"> = {
  git: "checked_in",
  "open-mic": "confirmed",
  "food-walk": "waitlisted",
  "first-job": "confirmed",
  "night-market": "confirmed",
};

// Small seeded random generator so every reset produces the same data.
function random(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function startTime(e: SeedEvent, now: Date) {
  const on = (days: number) => fromLocalInput(`${manilaDayKey(new Date(now.getTime() + days * 86_400_000))}T${e.at}`);
  if (e.soon) {
    const today = on(0);
    return today.getTime() - now.getTime() >= 3_600_000 ? today : on(1);
  }
  return on(e.day!);
}

export async function isEmpty(db: Db) {
  const [row] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(users);
  return row.n === 0;
}

export async function resetDatabase(db: Db) {
  await db.execute(sql`truncate table emails, registrations, events, sessions, users cascade`);
}

export async function seed(db: Db, now = new Date(), baseUrl = "http://localhost:3000") {
  const rand = random(20261018);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const ticketUrl = (code: string) => `${baseUrl}/tickets/${code}`;

  return db.transaction(async (tx) => {
    const orgRows = await tx
      .insert(users)
      .values(Object.values(ORGANIZERS).map((o) => ({ name: o.name, email: o.email })))
      .returning();
    const orgId = Object.fromEntries(
      (Object.keys(ORGANIZERS) as OrgKey[]).map((k) => [k, orgRows.find((r) => r.email === ORGANIZERS[k].email)!.id]),
    ) as Record<OrgKey, string>;

    const [demoAttendee] = await tx.insert(users).values(DEMO_ACCOUNTS.attendee).returning();

    // 160 people with unique name combinations.
    const names = new Set<string>();
    while (names.size < 160) names.add(`${pick(FIRST)} ${pick(LAST)}`);
    const people = await tx
      .insert(users)
      .values(
        [...names].map((name) => ({
          name,
          email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
        })),
      )
      .returning();

    const eventRows = await tx
      .insert(events)
      .values(
        EVENTS.map((e) => {
          const startsAt = startTime(e, now);
          const createdAt = new Date(Math.min(now.getTime(), startsAt.getTime()) - (18 + Math.floor(rand() * 14)) * 86_400_000);
          return {
            slug: e.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
            organizerId: orgId[e.org],
            title: e.title,
            summary: e.summary,
            description: e.description,
            category: e.category,
            status: e.status ?? "published",
            startsAt,
            endsAt: new Date(startsAt.getTime() + e.hours * 3_600_000),
            isOnline: e.isOnline ?? false,
            location: e.location,
            city: e.city,
            capacity: e.capacity,
            createdAt,
            updatedAt: createdAt,
            cancelledAt: e.status === "cancelled" ? new Date(now.getTime() - 86_400_000) : null,
          };
        }),
      )
      .returning();

    const regs: (typeof registrations.$inferInsert)[] = [];
    const inbox: (typeof emails.$inferInsert)[] = [];

    EVENTS.forEach((spec, i) => {
      const event = eventRows[i];
      if (event.status === "draft") return;

      const plan = DEMO_ATTENDEE_PLANS[spec.key];
      const total = spec.confirmed + (spec.waitlisted ?? 0);
      const crowd = [...people].sort(() => rand() - 0.5).slice(0, total);

      // Sign-up times between the event being posted and now (or the start),
      // bunched up a little near both ends like real sign-ups.
      const from = event.createdAt.getTime();
      const until = Math.min(now.getTime(), event.startsAt.getTime()) - 3_600_000;
      const times = crowd
        .map(() => {
          const r = rand();
          const curve = r < 0.5 ? 2 * r * r : 1 - 2 * (1 - r) * (1 - r);
          return new Date(from + curve * (until - from));
        })
        .sort((a, b) => a.getTime() - b.getTime());

      const ended = event.endsAt <= now;
      crowd.forEach((person, n) => {
        const confirmed = n < spec.confirmed;
        regs.push({
          eventId: event.id,
          userId: person.id,
          status: confirmed ? "confirmed" : "waitlisted",
          ticketCode: newTicketCode(),
          createdAt: times[n],
          confirmedAt: confirmed ? times[n] : null,
          checkedInAt:
            confirmed && ended && rand() < 0.82
              ? new Date(event.startsAt.getTime() + (rand() * 50 - 15) * 60_000)
              : null,
        });
      });

      // A few people who signed up and later changed their minds.
      for (const person of people.filter((p) => !crowd.includes(p)).slice(0, Math.ceil(total * 0.06))) {
        const at = new Date(from + rand() * (until - from) * 0.7);
        regs.push({
          eventId: event.id,
          userId: person.id,
          status: "cancelled",
          ticketCode: newTicketCode(),
          createdAt: at,
          cancelledAt: new Date(at.getTime() + rand() * 3 * 86_400_000),
        });
      }

      if (plan) {
        // Waitlisted people join after the event filled up; everyone else a while back.
        const at =
          plan === "waitlisted"
            ? new Date(Math.min(until, times[spec.confirmed + 1]?.getTime() ?? until) + 60_000)
            : new Date(from + (until - from) * 0.3);
        const status = plan === "waitlisted" ? "waitlisted" : "confirmed";
        const code = newTicketCode();
        regs.push({
          eventId: event.id,
          userId: demoAttendee.id,
          status,
          ticketCode: code,
          createdAt: at,
          confirmedAt: status === "confirmed" ? at : null,
          checkedInAt: plan === "checked_in" ? new Date(event.startsAt.getTime() - 10 * 60_000) : null,
        });

        const position = times.slice(spec.confirmed).filter((t) => t < at).length + 1;
        const draft =
          status === "waitlisted"
            ? templates.waitlisted(demoAttendee, event, position)
            : templates.confirmed(demoAttendee, event, ticketUrl(code));
        inbox.push({ ...toEmailRow(draft), createdAt: at });
        if (event.status === "cancelled") {
          inbox.push({ ...toEmailRow(templates.eventCancelled(demoAttendee, event)), createdAt: event.cancelledAt! });
        }
      }
    });

    // Insert in sign-up order so the queue numbers match the timeline.
    regs.sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime());
    for (let i = 0; i < regs.length; i += 500) await tx.insert(registrations).values(regs.slice(i, i + 500));
    if (inbox.length) await tx.insert(emails).values(inbox);

    return { users: people.length + orgRows.length + 1, events: eventRows.length, registrations: regs.length };
  });
}

function toEmailRow(d: ReturnType<(typeof templates)["confirmed"]>) {
  return { userId: d.userId, eventId: d.eventId, toEmail: d.to, kind: d.kind, subject: d.subject, body: d.body };
}
