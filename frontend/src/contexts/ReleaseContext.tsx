import { createContext, useContext, useState, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { integrationService, TicketsWithTestCases } from '../services/api';

interface ReleaseContextType {
  selectedReleases: string[];
  setSelectedReleases: (releases: string[]) => void;
  ticketsData: TicketsWithTestCases | null;
  isLoadingTickets: boolean;
  refreshTickets: () => void;
}

const ReleaseContext = createContext<ReleaseContextType | undefined>(undefined);

export const useReleaseContext = () => {
  const context = useContext(ReleaseContext);
  if (!context) {
    throw new Error('useReleaseContext must be used within ReleaseProvider');
  }
  return context;
};

interface ReleaseProviderProps {
  children: ReactNode;
}

export const ReleaseProvider = ({ children }: ReleaseProviderProps) => {
  const [selectedReleases, setSelectedReleases] = useState<string[]>([]);

  // Fetch tickets with test cases when releases are selected
  const { 
    data: ticketsData, 
    isLoading: isLoadingTickets,
    refetch: refreshTickets 
  } = useQuery({
    queryKey: ['tickets-with-testcases', selectedReleases.join(',')],
    queryFn: async () => {
      if (selectedReleases.length === 0) return null;
      const response = await integrationService.getTicketsWithTestCases(
        selectedReleases,
        1 // TestRail project ID
      );
      return response.data;
    },
    enabled: selectedReleases.length > 0,
  });

  return (
    <ReleaseContext.Provider
      value={{
        selectedReleases,
        setSelectedReleases,
        ticketsData: ticketsData || null,
        isLoadingTickets,
        refreshTickets,
      }}
    >
      {children}
    </ReleaseContext.Provider>
  );
};
