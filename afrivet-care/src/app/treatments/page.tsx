import Link from "next/link";
import { EntityForm } from "@/components/EntityForm";
import { AddPanel, Empty, PageHeader, Section, TreatmentList } from "@/components/ui";
import { nowLocal } from "@/lib/dates";
import { formFieldsOf } from "@/lib/schema";
import { getContext } from "@/lib/server";
import { dueTreatments } from "@/lib/insights";
export const metadata = { title: "Vaccines & meds" };

export default async function Page() {
  const { repo, ownerId, today, config } = await getContext();
  const [pets, rows] = await Promise.all([repo.list("pets", ownerId), repo.list("treatments", ownerId, { desc: true })]);
  const names = new Map(pets.map((p) => [p.id, p.name]));
  const now = nowLocal(config.timezone);
  void now;
  const dueIds = new Set(dueTreatments(rows, today).map((d) => d.treatment.id));
  const due = rows.filter((r) => dueIds.has(r.id)).sort((a, b) => a.next_due_on!.localeCompare(b.next_due_on!));
  const rest = rows.filter((r) => !dueIds.has(r.id));
  return (
    <>
      <PageHeader title="Vaccines & meds" />
      {pets.length === 0 ? (
        <Empty action={<Link href="/pets/new" className="btn btn-primary">Add a pet</Link>}>
          Add a pet first, then you can keep its vaccinations and medications here.
        </Empty>
      ) : (
        <>
          <AddPanel label="Add vaccination or medication" open={rows.length === 0}>
            <EntityForm
              target={{ table: "treatments" }}
              fields={formFieldsOf("treatments")}
              pets={pets.map((p) => ({ id: p.id, name: p.name }))}
              initial={{ pet_id: pets.length === 1 ? pets[0].id : "", given_on: today }}
              submitLabel="Save"
            />
          </AddPanel>
          {due.length > 0 && (
            <Section title="Overdue or due soon">
              <TreatmentList treatments={due} pets={names} today={today} dueIds={dueIds} />
            </Section>
          )}
          <Section title={due.length ? "Everything else" : "All vaccinations & medications"}>
            {rest.length ? <TreatmentList treatments={rest} pets={names} today={today} dueIds={dueIds} /> : <Empty>Nothing else recorded.</Empty>}
          </Section>
        </>
      )}
    </>
  );
}
