import { requireUser } from "@/lib/route-access";
import CallHistory from "@/components/call-history";

export default async function CallsPage() {
  await requireUser("/calls");
  return <CallHistory />;
}
