"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="welcome">
      <h1>Something went wrong</h1>
      <p>Your data is safe. Please try again; if this keeps happening the app may not be fully set up yet.</p>
      <button className="btn btn-primary" onClick={reset}>Try again</button>
    </div>
  );
}
