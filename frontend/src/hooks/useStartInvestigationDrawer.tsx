import { createContext, useContext, useMemo, useState } from "react";

export type ActionDrawerMode = "start-investigation" | "run-detector";

interface ActionDrawerState {
  isOpen: boolean;
  mode: ActionDrawerMode;
  defaultApplicationId?: string;
  sourceInvestigationName?: string;
  lockApplicationSelection?: boolean;
  traceFileId?: string;
  traceName?: string;
  defaultTechnique?: string;
  initialStep?: 1 | 2 | 3;
}

interface OpenActionDrawerOptions {
  mode?: ActionDrawerMode;
  defaultApplicationId?: string;
  sourceInvestigationName?: string;
  lockApplicationSelection?: boolean;
  traceFileId?: string;
  traceName?: string;
  defaultTechnique?: string;
  initialStep?: 1 | 2 | 3;
}

interface StartInvestigationDrawerContextValue {
  state: ActionDrawerState;
  openStartInvestigationDrawer: (options?: OpenActionDrawerOptions) => void;
  closeStartInvestigationDrawer: () => void;
  resetStartInvestigationDrawer: () => void;
}

const DEFAULT_DRAWER_STATE: ActionDrawerState = {
  isOpen: false,
  mode: "start-investigation",
};

const StartInvestigationDrawerContext =
  createContext<StartInvestigationDrawerContextValue | null>(null);

export function StartInvestigationDrawerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<ActionDrawerState>(DEFAULT_DRAWER_STATE);

  function openStartInvestigationDrawer(options?: OpenActionDrawerOptions) {
    setState({
      isOpen: true,
      mode: options?.mode ?? "start-investigation",
      defaultApplicationId: options?.defaultApplicationId,
      sourceInvestigationName: options?.sourceInvestigationName,
      lockApplicationSelection: options?.lockApplicationSelection,
      traceFileId: options?.traceFileId,
      traceName: options?.traceName,
      defaultTechnique: options?.defaultTechnique,
      initialStep: options?.initialStep,
    });
  }

  function closeStartInvestigationDrawer() {
    setState((current) => ({ ...current, isOpen: false }));
  }

  function resetStartInvestigationDrawer() {
    setState(DEFAULT_DRAWER_STATE);
  }

  const value = useMemo<StartInvestigationDrawerContextValue>(
    () => ({
      state,
      openStartInvestigationDrawer,
      closeStartInvestigationDrawer,
      resetStartInvestigationDrawer,
    }),
    [state],
  );

  return (
    <StartInvestigationDrawerContext.Provider value={value}>
      {children}
    </StartInvestigationDrawerContext.Provider>
  );
}

export function useStartInvestigationDrawer() {
  const context = useContext(StartInvestigationDrawerContext);
  if (!context) {
    throw new Error(
      "useStartInvestigationDrawer must be used within StartInvestigationDrawerProvider",
    );
  }
  return context;
}
