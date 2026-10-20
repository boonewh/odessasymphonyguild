"use client";
import { createContext, useContext } from "react";
const LiveContext = createContext(false);
export const useLiveGala = () => useContext(LiveContext);
export function GalaRuntime({ live, children }: { live: boolean; children: React.ReactNode }) {
  return <LiveContext.Provider value={live}>{children}</LiveContext.Provider>;
}
