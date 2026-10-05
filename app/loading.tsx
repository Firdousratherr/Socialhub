export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[900px] px-3 py-6 sm:px-5 lg:px-7">
      <div className="animate-pulse space-y-4" aria-label="Loading Socialhub">
        <div className="h-6 w-32 rounded-lg bg-gray-200" />
        <div className="h-4 w-64 rounded-lg bg-gray-200" />
        <div className="social-card rounded-3xl p-5"><div className="h-12 w-1/3 rounded-xl bg-gray-100" /><div className="mt-4 h-28 w-full rounded-2xl bg-gray-100" /></div>
        <div className="social-card rounded-3xl p-5"><div className="h-12 w-1/2 rounded-xl bg-gray-100" /><div className="mt-4 h-52 w-full rounded-2xl bg-gray-100" /></div>
      </div>
    </main>
  );
}