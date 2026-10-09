import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { VenueApplicationService } from "@/application/VenueApplicationService";
import { container } from "@/di/container";
import { Role } from "@/security/Role";
import { EventForm } from "./_components/EventForm";

export default async function EventCreatePage() {
  const session = await auth();

  if (!session?.user.roles.includes(Role.ADMIN)) {
    notFound();
  }

  const venueApplicationService = container.get(VenueApplicationService);
  const venues = await venueApplicationService.list();

  return (
    <main id="main-content" className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight">催事作成</h1>
      <p className="mt-4 text-sm text-slate-600">
        日時はすべて日本時間（JST）で入力してください。
      </p>
      <EventForm
        venues={venues.map((venue) => ({ id: venue.id, name: venue.name }))}
      />
    </main>
  );
}
