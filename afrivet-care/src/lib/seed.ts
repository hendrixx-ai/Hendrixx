import type { Repo } from "./repo";
import { addDays } from "./dates";

/** Sample data shown in demo mode so the screens are not empty. */
export async function seedDemo(repo: Repo, ownerId: string, today: string) {
  const d = (n: number) => addDays(today, n);
  const simba = await repo.insert("pets", ownerId, {
    name: "Simba", species: "dog", breed: "Boerboel", sex: "male", birth_date: d(-1250), weight_kg: 58,
    notes: "Guard dog. Nervous around strangers at the clinic.",
  });
  const neema = await repo.insert("pets", ownerId, {
    name: "Neema", species: "cat", breed: "Domestic shorthair", sex: "female", birth_date: d(-410), weight_kg: 3.6,
  });
  const zawadi = await repo.insert("pets", ownerId, {
    name: "Zawadi", species: "cattle", breed: "Ankole", sex: "female", birth_date: d(-1900), weight_kg: 420,
    notes: "Lead cow of the herd.",
  });

  await repo.insert("treatments", ownerId, {
    pet_id: simba.id, type: "vaccination", name: "Rabies", dose: "1 ml", given_on: d(-372), next_due_on: d(-7),
  });
  await repo.insert("treatments", ownerId, {
    pet_id: simba.id, type: "medication", name: "Deworming (praziquantel)", dose: "1 tablet per 10 kg",
    given_on: d(-78), next_due_on: d(12),
  });
  await repo.insert("treatments", ownerId, {
    pet_id: neema.id, type: "vaccination", name: "Feline tricat", dose: "1 ml", given_on: d(-200), next_due_on: d(165),
  });
  await repo.insert("treatments", ownerId, {
    pet_id: zawadi.id, type: "vaccination", name: "East Coast fever (ECF)", given_on: d(-600),
    notes: "Single lifetime dose.",
  });
  await repo.insert("treatments", ownerId, {
    pet_id: zawadi.id, type: "vaccination", name: "Foot-and-mouth disease", given_on: d(-160), next_due_on: d(22),
  });

  await repo.insert("health_records", ownerId, {
    pet_id: simba.id, title: "Annual check-up", kind: "checkup", record_date: d(-78), vet_name: "Dr. Mollel",
    notes: "Healthy weight. Mild tartar, recommended dental chews.",
  });
  await repo.insert("health_records", ownerId, {
    pet_id: neema.id, title: "Spay surgery", kind: "surgery", record_date: d(-190), vet_name: "Arusha Vet Clinic",
    notes: "Recovered well, stitches removed after 10 days.",
  });
  await repo.insert("health_records", ownerId, {
    pet_id: zawadi.id, title: "Tick-borne fever", kind: "illness", record_date: d(-31), vet_name: "Dr. Laizer",
    notes: "Treated with oxytetracycline for 5 days. Appetite back to normal.",
  });

  await repo.insert("appointments", ownerId, {
    pet_id: simba.id, title: "Rabies booster", scheduled_at: `${d(2)}T09:30`, clinic: "Arusha Vet Clinic",
    status: "scheduled",
  });
  await repo.insert("appointments", ownerId, {
    pet_id: zawadi.id, title: "Herd health visit", scheduled_at: `${d(9)}T07:00`, clinic: "Dr. Laizer (farm visit)",
    status: "scheduled",
  });
  await repo.insert("appointments", ownerId, {
    pet_id: neema.id, title: "Post-surgery check", scheduled_at: `${d(-180)}T14:00`, clinic: "Arusha Vet Clinic",
    status: "completed",
  });
}
