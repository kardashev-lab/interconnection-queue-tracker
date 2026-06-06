import { QueueTracker } from "@/components/queue-tracker";
import { getQueuePayload } from "@/lib/queue";

export const dynamic = "force-dynamic";

export default async function Home() {
  const payload = await getQueuePayload();
  return <QueueTracker initial={payload} />;
}
