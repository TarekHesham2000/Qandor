"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-black">حصلت مشكلة عندنا</h1>
      <p className="mt-2 text-ink/65">جرّب تاني بعد لحظات. لو المشكلة فضلت، كلّم صاحب المحل.</p>
      <button onClick={reset} className="btn btn-primary mt-6">حاول تاني</button>
    </main>
  );
}
