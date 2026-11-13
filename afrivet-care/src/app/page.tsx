import Link from "next/link";
import { AppointmentList, Badge, Empty, PetAvatar, RecordList, Section } from "@/components/ui";
import { ageLabel, dueLabel, formatDate, nowLocal } from "@/lib/dates";
import { dueTreatments, missedAppointments, upcomingAppointments } from "@/lib/insights";
import { getContext } from "@/lib/server";

export default async function DashboardPage() {
  const { repo, ownerId, today, config } = await getContext();
  const [pets, appointments, treatments, records] = await Promise.all([
    repo.list("pets", ownerId),
    repo.list("appointments", ownerId),
    repo.list("treatments", ownerId),
    repo.list("health_records", ownerId, { desc: true }),
  ]);
  const now = nowLocal(config.timezone);
  const names = new Map(pets.map((p) => [p.id, p.name]));
  const upcoming = upcomingAppointments(appointments, now);
  const missed = missedAppointments(appointments, now);
  const due = dueTreatments(treatments, today);
  const overdue = due.filter((d) => d.status === "overdue").length;

  if (pets.length === 0) {
    return (
      <div className="welcome">
        <h1>Welcome to AFRIVet Care</h1>
        <p>Keep every vaccination, vet visit and health record for your animals in one place.</p>
        <Link href="/pets/new" className="btn btn-primary btn-large">Add your first pet</Link>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">{formatDate(today)}</p>
          <h1>Today</h1>
        </div>
        <Link href="/pets/new" className="btn btn-primary">+ Add pet</Link>
      </div>

      <div className="stats">
        <Link href="/pets" className="stat">
          <span className="stat-value">{pets.length}</span>
          <span className="stat-label">{pets.length === 1 ? "Pet" : "Pets"}</span>
        </Link>
        <Link href="/appointments" className="stat">
          <span className="stat-value">{upcoming.length}</span>
          <span className="stat-label">Upcoming {upcoming.length === 1 ? "visit" : "visits"}</span>
        </Link>
        <Link href="/treatments" className={`stat${overdue ? " stat-danger" : ""}`}>
          <span className="stat-value">{due.length}</span>
          <span className="stat-label">{overdue ? `Due · ${overdue} overdue` : "Due within 30 days"}</span>
        </Link>
      </div>

      <Section title="Needs attention" action={<Link href="/treatments" className="link">All vaccines &amp; meds</Link>}>
        {due.length === 0 && missed.length === 0 ? (
          <Empty>Nothing is due. All vaccinations and medications are up to date.</Empty>
        ) : (
          <ul className="list">
            {due.map(({ treatment: t, status }) => (
              <li key={t.id} className="row">
                <div className="row-main">
                  <p className="row-title">{t.name}</p>
                  <p className="row-meta">
                    <Link href={`/pets/${t.pet_id}`} className="pet-tag">{names.get(t.pet_id)}</Link>{" "}
                    <Badge tone="muted">{t.type}</Badge> {formatDate(t.next_due_on)}
                  </p>
                </div>
                <Badge tone={status === "overdue" ? "danger" : "warn"}>{dueLabel(t.next_due_on!, today)}</Badge>
              </li>
            ))}
            {missed.map((a) => (
              <li key={a.id} className="row">
                <div className="row-main">
                  <p className="row-title">{a.title}</p>
                  <p className="row-meta">
                    <Link href={`/pets/${a.pet_id}`} className="pet-tag">{names.get(a.pet_id)}</Link> Visit time has
                    passed
                  </p>
                </div>
                <Link href="/appointments" className="btn btn-small">Update</Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Upcoming visits" action={<Link href="/appointments" className="link">All visits</Link>}>
        {upcoming.length ? (
          <AppointmentList appointments={upcoming.slice(0, 3)} pets={names} now={now} />
        ) : (
          <Empty action={<Link href="/appointments" className="btn btn-secondary">Book a visit</Link>}>
            No visits booked.
          </Empty>
        )}
      </Section>

      <Section title="Your pets" action={<Link href="/pets" className="link">All pets</Link>}>
        <ul className="pet-strip">
          {pets.map((p) => (
            <li key={p.id}>
              <Link href={`/pets/${p.id}`} className="pet-chip">
                <PetAvatar pet={p} size={56} />
                <span className="pet-chip-name">{p.name}</span>
                <span className="row-meta">{ageLabel(p.birth_date, today) ?? p.species}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Recent health records" action={<Link href="/records" className="link">All records</Link>}>
        {records.length ? (
          <RecordList records={records.slice(0, 3)} pets={names} />
        ) : (
          <Empty>No health records yet.</Empty>
        )}
      </Section>
    </>
  );
}
