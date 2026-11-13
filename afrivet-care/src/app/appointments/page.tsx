import Link from "next/link";
import { EntityForm } from "@/components/EntityForm";
import { AddPanel, Empty, PageHeader, Section, AppointmentList } from "@/components/ui";
import { nowLocal } from "@/lib/dates";
import { formFieldsOf } from "@/lib/schema";
import { getContext } from "@/lib/server";

export const metadata = { title: "Visits" };

export default async function Page() {
  const { repo, ownerId, today, config } = await getContext();
  const [pets, rows] = await Promise.all([repo.list("pets", ownerId), repo.list("appointments", ownerId, { desc: true })]);
  const names = new Map(pets.map((p) => [p.id, p.name]));
  const now = nowLocal(config.timezone);
  const open = rows.filter((a) => a.status === "scheduled").reverse();
  const past = rows.filter((a) => a.status !== "scheduled");
  return (
    <>
      <PageHeader title="Visits" />
      {pets.length === 0 ? (
        <Empty action={<Link href="/pets/new" className="btn btn-primary">Add a pet</Link>}>
          Add a pet first, then you can keep its vet visits here.
        </Empty>
      ) : (
        <>
          <AddPanel label="Book a visit" open={rows.length === 0}>
            <EntityForm
              target={{ table: "appointments" }}
              fields={formFieldsOf("appointments")}
              pets={pets.map((p) => ({ id: p.id, name: p.name }))}
              initial={{ pet_id: pets.length === 1 ? pets[0].id : "",  }}
              submitLabel="Save"
            />
          </AddPanel>
          <Section title="Scheduled">
            {open.length ? <AppointmentList appointments={open} pets={names} now={now} /> : <Empty>No visits booked.</Empty>}
          </Section>
          {past.length > 0 && (
            <Section title="Completed & cancelled">
              <AppointmentList appointments={past} pets={names} now={now} />
            </Section>
          )}
        </>
      )}
    </>
  );
}
