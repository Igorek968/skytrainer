"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "sonner";

import { LessonPushRegistrar } from "@/features/push/lesson-push-registrar";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            gcTime: 10 * 60 * 1000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            retry: 1,
          },
        },
      })
  );

  return (
    <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus={false}>
      <QueryClientProvider client={client}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <LessonPushRegistrar />
          <Toaster richColors closeButton position="top-center" />
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
