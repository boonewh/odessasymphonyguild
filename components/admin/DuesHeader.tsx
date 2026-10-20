"use client";
import { createContext, useContext } from "react";
import Header from "@/components/Header";

const SharedDuesContext = createContext(false);
export const useSharedDues = () => useContext(SharedDuesContext);
export function SharedDuesProvider({ children }: { children: React.ReactNode }) {
  return <SharedDuesContext.Provider value>{children}</SharedDuesContext.Provider>;
}
export default function DuesHeader() {
  return useSharedDues() ? null : <Header />;
}
