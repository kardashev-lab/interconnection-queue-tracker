import type { Metadata } from "next";
import { getInterconnectionTimelines } from "@/lib/interconnection-timelines";
import { InterconnectionTimelinesView } from "@/components/interconnection-timelines-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ERCOT Interconnection Timelines — How Long It Actually Takes",
  description:
    "Empirical ERCOT interconnection queue timelines by zone and fuel type, built from 97 months of public GIS Report filings (Dec 2018 - Jun 2026).",
  alternates: { canonical: "/interconnection-timelines" },
};

export default async function InterconnectionTimelinesPage() {
  const data = await getInterconnectionTimelines();
  return <InterconnectionTimelinesView data={data} />;
}
