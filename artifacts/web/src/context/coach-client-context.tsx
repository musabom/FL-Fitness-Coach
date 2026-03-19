import { createContext, useContext, useState, type ReactNode } from "react";

interface CoachClient {
  id: number;
  name: string;
  email: string;
}

interface CoachClientContextValue {
  activeClient: CoachClient | null;
  setActiveClient: (client: CoachClient | null) => void;
  clientId: number | null;
}

const CoachClientContext = createContext<CoachClientContextValue>({
  activeClient: null,
  setActiveClient: () => {},
  clientId: null,
});

export function CoachClientProvider({ children }: { children: ReactNode }) {
  const [activeClient, setActiveClient] = useState<CoachClient | null>(null);

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
 * Appends ?clientId=X to a URL string when in coach mode.
 */
export function useClientUrl() {
  const { clientId } = useCoachClient();
  return (url: string): string => {
    if (!clientId) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}clientId=${clientId}`;
  };
}
