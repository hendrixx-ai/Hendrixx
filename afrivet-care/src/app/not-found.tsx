import Link from "next/link";

export default function NotFound() {
  return (
    <div className="welcome">
      <h1>Page not found</h1>
      <p>That page does not exist, or it belongs to another account.</p>
      <Link href="/" className="btn btn-primary">Back to home</Link>
    </div>
  );
}
