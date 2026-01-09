import { create } from 'zustand';
import type { Service } from '../services/api/services';

interface ServiceState {
  services: Service[];
  selectedService: Service | null;
  setServices: (services: Service[]) => void;
  setSelectedService: (service: Service | null) => void;
}

export const useServiceStore = create<ServiceState>((set) => ({
  services: [],
  selectedService: null,
  setServices: (services) => set({ services }),
  setSelectedService: (service) => set({ selectedService: service }),
}));
