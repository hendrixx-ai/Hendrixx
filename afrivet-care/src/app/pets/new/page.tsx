import { EntityForm } from "@/components/EntityForm";
import { PageHeader } from "@/components/ui";
import { formFieldsOf } from "@/lib/schema";
import { requireOwnerId } from "@/lib/server";

export const metadata = { title: "Add pet" };

export default async function NewPetPage() {
  await requireOwnerId();
  return (
    <>
      <PageHeader title="Add a pet" back={{ href: "/pets", label: "Pets" }} />
      <div className="card">
        <EntityForm target={{ table: "pets" }} fields={formFieldsOf("pets")} submitLabel="Save pet" />
      </div>
    </>
  );
}
