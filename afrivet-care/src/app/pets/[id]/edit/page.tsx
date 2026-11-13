import { notFound } from "next/navigation";
import { EntityForm } from "@/components/EntityForm";
import { PageHeader } from "@/components/ui";
import { formFieldsOf } from "@/lib/schema";
import { getContext } from "@/lib/server";

export const metadata = { title: "Edit pet" };

export default async function EditPetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { repo, ownerId } = await getContext();
  const pet = await repo.get("pets", ownerId, id);
  if (!pet) notFound();
  const { id: _id, owner_id: _o, created_at: _c, photo_url: _p, ...initial } = pet;

  return (
    <>
      <PageHeader title={`Edit ${pet.name}`} back={{ href: `/pets/${pet.id}`, label: pet.name }} />
      <div className="card">
        <EntityForm
          target={{ table: "pets", id: pet.id, redirectTo: `/pets/${pet.id}` }}
          fields={formFieldsOf("pets")}
          initial={initial}
          submitLabel="Save changes"
        />
      </div>
    </>
  );
}
