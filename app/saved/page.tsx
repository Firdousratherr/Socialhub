import { requireUser } from "@/lib/route-access";
import SavedPosts from "@/components/saved-posts";

export const metadata = { title: "Saved posts" };

export default async function SavedPage() {
  await requireUser("/saved");
  return <SavedPosts />;
}
