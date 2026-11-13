import Link from "next/link";
import type { ReactNode } from "react";
import { deleteAction, setAppointmentStatus } from "@/app/actions";
import { dueLabel, dueStatus, formatDate, formatDateTime } from "@/lib/dates";
import type { Appointment, Attachment, HealthRecord, Pet, Treatment } from "@/lib/schema";
import { ActionButton } from "./ConfirmButton";

const SPECIES_EMOJI: Record<string, string> = {
  dog: "🐕", cat: "🐈", cattle: "🐄", goat: "🐐", sheep: "🐑", poultry: "🐓", donkey: "🐴", other: "🐾",
};

export function PetAvatar({ pet, size = 48 }: { pet: Pick<Pet, "species" | "photo_url" | "name">; size?: number }) {
  const style = { width: size, height: size, fontSize: size * 0.5 };
  return pet.photo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="avatar" src={pet.photo_url} alt={`Photo of ${pet.name}`} style={style} />
  ) : (
    <span className="avatar" style={style} aria-hidden="true">{SPECIES_EMOJI[pet.species] ?? "🐾"}</span>
  );
}

export function PageHeader({ title, action, back }: { title: string; action?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="page-header">
      <div>
        {back && <Link href={back.href} className="back">‹ {back.label}</Link>}
        <h1>{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function Section({ title, id, action, children }: { title: string; id?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section" id={id}>
      <div className="section-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <p>{children}</p>
      {action}
    </div>
  );
}

export function AddPanel({ label, children, open }: { label: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="add-panel" open={open}>
      <summary className="btn btn-secondary">+ {label}</summary>
      <div className="add-panel-body">{children}</div>
    </details>
  );
}

export function Badge({ tone, children }: { tone: "danger" | "warn" | "ok" | "muted"; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function DeleteButton({ table, id, what }: { table: string; id: string; what: string }) {
  return (
    <ActionButton
      action={deleteAction.bind(null, table, id, undefined)}
      confirm={`Delete ${what}? This cannot be undone.`}
      className="icon-btn"
      label={`Delete ${what}`}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7M10 11v5M14 11v5" />
      </svg>
    </ActionButton>
  );
}

type PetNames = Map<string, string>;
const petLink = (pets: PetNames | undefined, id: string) =>
  pets?.has(id) ? <Link href={`/pets/${id}`} className="pet-tag">{pets.get(id)}</Link> : null;

/** Pass `pets` to show which pet each row belongs to (omit on a pet's own page). */
export function RecordList({ records, pets }: { records: HealthRecord[]; pets?: PetNames }) {
  return (
    <ul className="list">
      {records.map((r) => (
        <li key={r.id} className="row">
          <div className="row-main">
            <p className="row-title">{r.title}</p>
            <p className="row-meta">
              {petLink(pets, r.pet_id)} <Badge tone="muted">{r.kind}</Badge> {formatDate(r.record_date)}
              {r.vet_name && ` · ${r.vet_name}`}
            </p>
            {r.notes && <p className="row-notes">{r.notes}</p>}
          </div>
          <DeleteButton table="health_records" id={r.id} what={`“${r.title}”`} />
        </li>
      ))}
    </ul>
  );
}

/** `dueIds` holds the entries that still need action; older doses that were followed up show no warning. */
export function TreatmentList({ treatments, pets, today, dueIds }: { treatments: Treatment[]; pets?: PetNames; today: string; dueIds: Set<string> }) {
  return (
    <ul className="list">
      {treatments.map((t) => {
        const status = dueIds.has(t.id) ? dueStatus(t.next_due_on, today) : "none";
        return (
          <li key={t.id} className="row">
            <div className="row-main">
              <p className="row-title">{t.name}</p>
              <p className="row-meta">
                {petLink(pets, t.pet_id)} <Badge tone="muted">{t.type}</Badge> Given {formatDate(t.given_on)}
                {t.dose && ` · ${t.dose}`}
              </p>
              {t.next_due_on && (
                <p className="row-meta">
                  Next due {formatDate(t.next_due_on)}{" "}
                  {status === "overdue" && <Badge tone="danger">{dueLabel(t.next_due_on, today)}</Badge>}
                  {status === "soon" && <Badge tone="warn">{dueLabel(t.next_due_on, today)}</Badge>}
                </p>
              )}
              {t.notes && <p className="row-notes">{t.notes}</p>}
            </div>
            <DeleteButton table="treatments" id={t.id} what={`“${t.name}”`} />
          </li>
        );
      })}
    </ul>
  );
}

export function AppointmentList({ appointments, pets, now }: { appointments: Appointment[]; pets?: PetNames; now: string }) {
  return (
    <ul className="list">
      {appointments.map((a) => {
        const missed = a.status === "scheduled" && a.scheduled_at < now;
        return (
          <li key={a.id} className="row">
            <div className="row-main">
              <p className="row-title">{a.title}</p>
              <p className="row-meta">
                {petLink(pets, a.pet_id)} {formatDateTime(a.scheduled_at)}
                {a.clinic && ` · ${a.clinic}`}{" "}
                {missed && <Badge tone="warn">needs update</Badge>}
                {a.status === "completed" && <Badge tone="ok">completed</Badge>}
                {a.status === "cancelled" && <Badge tone="muted">cancelled</Badge>}
              </p>
              {a.notes && <p className="row-notes">{a.notes}</p>}
              {a.status === "scheduled" && (
                <div className="row-actions">
                  <ActionButton action={setAppointmentStatus.bind(null, a.id, "completed")} className="btn btn-small">
                    Mark done
                  </ActionButton>
                  <ActionButton
                    action={setAppointmentStatus.bind(null, a.id, "cancelled")}
                    className="btn btn-small btn-ghost"
                    confirm={`Cancel “${a.title}”?`}
                  >
                    Cancel visit
                  </ActionButton>
                </div>
              )}
            </div>
            <DeleteButton table="appointments" id={a.id} what={`“${a.title}”`} />
          </li>
        );
      })}
    </ul>
  );
}

const fileSize = (n: number) => (n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function FileGrid({ files }: { files: Attachment[] }) {
  return (
    <ul className="files">
      {files.map((f) => {
        const url = `/api/files/${f.id}`;
        return (
          <li key={f.id} className="file">
            <a href={url} target="_blank" rel="noreferrer" className="file-thumb">
              {f.content_type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={f.file_name} loading="lazy" />
              ) : (
                <span aria-hidden="true">PDF</span>
              )}
            </a>
            <div className="file-info">
              <p className="file-name" title={f.file_name}>{f.file_name}</p>
              <p className="row-meta">{fileSize(f.size_bytes)}</p>
            </div>
            <DeleteButton table="attachments" id={f.id} what={`“${f.file_name}”`} />
          </li>
        );
      })}
    </ul>
  );
}
