import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteAction } from "@/app/actions";
import { ActionButton } from "@/components/ConfirmButton";
import { EntityForm } from "@/components/EntityForm";
import { UploadForm } from "@/components/UploadForm";
import { AddPanel, AppointmentList, Empty, FileGrid, PageHeader, PetAvatar, RecordList, Section, TreatmentList } from "@/components/ui";
import { ageLabel, formatDate, nowLocal } from "@/lib/dates";
import { dueTreatments } from "@/lib/insights";
import { formFieldsOf } from "@/lib/schema";
import { getContext } from "@/lib/server";

export default async function PetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { repo, ownerId, today, config } = await getContext();
  const pet = await repo.get("pets", ownerId, id);
  if (!pet) notFound();

  const where = { pet_id: pet.id };
  const [records, treatments, appointments, files] = await Promise.all([
    repo.list("health_records", ownerId, { where, desc: true }),
    repo.list("treatments", ownerId, { where, desc: true }),
    repo.list("appointments", ownerId, { where, desc: true }),
    repo.list("attachments", ownerId, { where, desc: true }),
  ]);
  const now = nowLocal(config.timezone);
  const dueIds = new Set(dueTreatments(treatments, today).map((d) => d.treatment.id));
  const facts = [
    ["Species", pet.species],
    ["Breed", pet.breed],
    ["Sex", pet.sex],
    ["Born", pet.birth_date && `${formatDate(pet.birth_date)} (${ageLabel(pet.birth_date, today)})`],
    ["Weight", pet.weight_kg !== null && `${pet.weight_kg} kg`],
  ].filter((f): f is [string, string] => !!f[1]);
  const form = (table: "health_records" | "treatments" | "appointments", label: string, initial = {}) => (
    <EntityForm
      target={{ table }}
      fields={formFieldsOf(table)}
      hidden={["pet_id"]}
      initial={{ pet_id: pet.id, ...initial }}
      submitLabel={label}
    />
  );

  return (
    <>
      <PageHeader
        title={pet.name}
        back={{ href: "/pets", label: "Pets" }}
        action={<Link href={`/pets/${pet.id}/edit`} className="btn btn-secondary">Edit</Link>}
      />

      <div className="card profile">
        <div className="profile-photo">
          <PetAvatar pet={pet} size={88} />
          <UploadForm petId={pet.id} purpose="photo" label={pet.photo_url ? "Change photo" : "Add photo"} className="link-btn" />
        </div>
        <dl className="facts">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {pet.notes && <p className="row-notes profile-notes">{pet.notes}</p>}
      </div>

      <Section title="Vaccinations & medications" id="treatments">
        {treatments.length ? <TreatmentList treatments={treatments} today={today} dueIds={dueIds} /> : <Empty>Nothing recorded yet.</Empty>}
        <AddPanel label="Add vaccination or medication">{form("treatments", "Save", { given_on: today })}</AddPanel>
      </Section>

      <Section title="Health records" id="records">
        {records.length ? <RecordList records={records} /> : <Empty>No health records yet.</Empty>}
        <AddPanel label="Add health record">{form("health_records", "Save record", { record_date: today })}</AddPanel>
      </Section>

      <Section title="Visits" id="appointments">
        {appointments.length ? <AppointmentList appointments={appointments} now={now} /> : <Empty>No visits booked.</Empty>}
        <AddPanel label="Book a visit">{form("appointments", "Save visit")}</AddPanel>
      </Section>

      <Section title="Files & photos" id="files">
        {files.length ? <FileGrid files={files} /> : <Empty>No files yet. Add lab results, prescriptions or photos.</Empty>}
        <UploadForm petId={pet.id} label="+ Upload file or photo" />
        <p className="hint">JPG, PNG, WebP or PDF, up to 4 MB.</p>
      </Section>

      <div className="danger-zone">
        <ActionButton
          action={deleteAction.bind(null, "pets", pet.id, "/pets")}
          confirm={`Delete ${pet.name} and all of their records, visits and files? This cannot be undone.`}
          className="btn btn-danger"
        >
          Delete {pet.name}
        </ActionButton>
      </div>
    </>
  );
}
