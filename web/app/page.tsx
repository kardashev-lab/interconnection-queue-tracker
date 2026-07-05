import { QueueTracker } from "@/components/queue-tracker";
import { getQueuePayload } from "@/lib/queue";
import { getErcotLargeLoadHistory } from "@/lib/ercot-large-load";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [payload, ercotLargeLoad] = await Promise.all([
    getQueuePayload(),
    getErcotLargeLoadHistory(),
  ]);
  return <QueueTracker initial={payload} ercotLargeLoad={ercotLargeLoad} />;
}
