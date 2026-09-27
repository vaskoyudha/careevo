import type { Metadata } from "next";
import { MostPopularCoursesView } from "@/components/features/marketing/explore-most-popular-view";

export const metadata: Metadata = {
  title: "Most popular courses and skills | Careevo",
  description:
    "Explore our top courses and skills, loved by learners and developed by leading experts from Google, IBM, Microsoft, and global institutions.",
};
export default function MostPopularCoursesPage() {
  return <MostPopularCoursesView />;
}
