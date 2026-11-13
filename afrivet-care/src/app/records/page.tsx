import Link from "next/link";
import { EntityForm } from "@/components/EntityForm";
import { AddPanel, Empty, PageHeader, Section, RecordList } from "@/components/ui";
import { nowLocal } from "@/lib/dates";
import { formFieldsOf } from "@/lib/schema";
import { getContext } from "@/lib/server";

export const metadata = { title: "Health records" };

export default async function Page() {
  const { repo, ownerId, today, config } = await getContext();
  const [pets, rows] = await Promise.all([repo.list("pets", ownerId), repo.list("health_records", ownerId, { desc: true })]);
  const names = new Map(pets.map((p) => [p.id, p.name]));
  const now = nowLocal(config.timezone);
  void now;
  return (
    <>
      <PageHeader title="Health records" />
      {pets.length === 0 ? (
        <Empty action={<Link href="/pets/new" className="btn btn-primary">Add a pet</Link>}>
          Add a pet first, then you can keep its health records here.
        </Empty>
      ) : (
        <>
          <AddPanel label="Add health record" open={rows.length === 0}>
            <EntityForm
              target={{ table: "health_records" }}
              fields={formFieldsOf("health_records")}
              pets={pets.map((p) => ({ id: p.id, name: p.name }))}
              initial={{ pet_id: pets.length === 1 ? pets[0].id : "", record_date: today }}
              submitLabel="Save"
            />
          </AddPanel>
          <Section title="All records">
            {rows.length ? <RecordList records={rows} pets={names} /> : <Empty>No health records yet.</Empty>}
          </Section>
        </>
      )}
    </>
  );
}
