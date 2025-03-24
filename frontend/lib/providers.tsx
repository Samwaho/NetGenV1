"use client";

import { ReactNode } from 'react';
import { ApolloProvider } from '@apollo/client';
import { ThemeProvider } from "next-themes";
import { client } from '@/lib/apollo-client';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="netgngql-theme"
    >
      <ApolloProvider client={client}>
        {children}
      </ApolloProvider>
    </ThemeProvider>
  );
}
