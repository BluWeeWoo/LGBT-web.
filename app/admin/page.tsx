import ReviewPage from "../../components/ReviewPage";
import "./review.css";

export const metadata = { title: "Story review · RYE", robots: { index: false, follow: false } };

export default function AdminPage() {
  return <ReviewPage />;
}
