"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "sonner";

import { LessonPushRegistrar } from "@/features/push/lesson-push-registrar";
import { SitePushForegroundBridge } from "@/features/push/site-push-foreground-bridge";
import { ClientRemindersRoot } from "@/features/client/client-reminders-root";
import { PwaServiceWorkerRegister } from "@/features/share/pwa-service-worker-register";
import { SupportProvider } from "@/features/support/support-provider";

export function AppProviders({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
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
    <SessionProvider session={session} refetchInterval={60} refetchOnWindowFocus>
      <QueryClientProvider client={client}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <SupportProvider>
            <PwaServiceWorkerRegister />
            <SitePushForegroundBridge />
            {children}
            <ClientRemindersRoot />
            <LessonPushRegistrar />
            <Toaster richColors closeButton position="top-center" />
          </SupportProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
