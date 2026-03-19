import { createContext, useContext, useState, type ReactNode } from "react";

interface ImpersonatedUser {
  id: number;
  name: string;
  email: string;
  mode: "coach" | "admin"; // which management view to return to
}

interface CoachClientContextValue {
  activeClient: ImpersonatedUser | null;
  setActiveClient: (client: ImpersonatedUser | null) => void;
  clientId: number | null;
}

const CoachClientContext = createContext<CoachClientContextValue>({
  activeClient: null,
  setActiveClient: () => {},
  clientId: null,
});

export function CoachClientProvider({ children }: { children: ReactNode }) {
  const [activeClient, setActiveClient] = useState<ImpersonatedUser | null>(null);

  return (
    <CoachClientContext.Provider value={{
      activeClient,
      setActiveClient,
      clientId: activeClient?.id ?? null,
    }}>
      {children}
    </CoachClientContext.Provider>
  );
}

export function useCoachClient() {
  return useContext(CoachClientContext);
}

/**
 * Appends ?clientId=X to a URL string when in coach/admin impersonation mode.
 */
export function useClientUrl() {
  const { clientId } = useCoachClient();
  return (url: string): string => {
    if (!clientId) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}clientId=${clientId}`;
  };
}
