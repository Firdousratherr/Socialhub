import { requireUser } from "@/lib/route-access";
import HomeFeed from "@/components/home-feed";

export const metadata = {
  title: "Home",
};

export default async function HomePage() {
  await requireUser("/home");
  return <HomeFeed />;
}
