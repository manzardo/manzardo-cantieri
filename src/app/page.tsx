"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// La home reindirizza alla lista dei cantieri.
// Se l'utente non è loggato, il layout interno lo manda al login.
export default function Index() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/timeline");
  }, [router]);
  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <p className="text-gray-500">Apertura…</p>
    </main>
  );
}
