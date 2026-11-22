interface MemberDashboardProps {
  userProfile: UserProfile | null;
  packages: ParcelPackage[];
  agents: AgentDirectoryItem[];
  subscriptions: Subscription[];
  deposits: Deposit[];
  lockedSimulation: SimulationLock | null;
  depositSettings?: {
    qr_code_url?: string;
    qr_is?: string;
    rekening_number?: string;
    rekening_bank?: string;
    rekening_atas_nama?: string;
  };
  onUpdateDepositSettings?: (settings: {
    qr_code_url?: string;
    qr_is?: string;
    rekening_number?: string;
    rekening_bank?: string;
    rekening_atas_nama?: string;
  }) => void;
  onClearLockedSimulation: () => void;
  onNeedLogin: () => void;
}