import Link from "next/link";
import { Badge, Empty, PageHeader, PetAvatar } from "@/components/ui";
import { ageLabel } from "@/lib/dates";
import { dueTreatments } from "@/lib/insights";
import { getContext } from "@/lib/server";

export const metadata = { title: "Pets" };

export default async function PetsPage() {
  const { repo, ownerId, today } = await getContext();
  const [pets, treatments] = await Promise.all([repo.list("pets", ownerId), repo.list("treatments", ownerId)]);
  const due = dueTreatments(treatments, today);

  return (
    <>
      <PageHeader title="Pets" action={<Link href="/pets/new" className="btn btn-primary">+ Add pet</Link>} />
      {pets.length === 0 ? (
        <Empty action={<Link href="/pets/new" className="btn btn-primary">Add your first pet</Link>}>
          You have not added any pets yet.
        </Empty>
      ) : (
        <ul className="cards">
          {pets.map((p) => {
            const mine = due.filter((d) => d.treatment.pet_id === p.id);
            const overdue = mine.some((d) => d.status === "overdue");
            return (
              <li key={p.id}>
                <Link href={`/pets/${p.id}`} className="card pet-card">
                  <PetAvatar pet={p} size={60} />
                  <div className="row-main">
                    <p className="row-title">{p.name}</p>
                    <p className="row-meta">
                      {[p.breed ?? p.species, p.sex, ageLabel(p.birth_date, today)].filter(Boolean).join(" · ")}
                    </p>
                    {mine.length > 0 && (
                      <Badge tone={overdue ? "danger" : "warn"}>
                        {mine.length} {overdue ? "overdue / due" : "due soon"}
                      </Badge>
                    )}
                  </div>
                  <span className="chevron" aria-hidden="true">›</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
