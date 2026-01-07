// MOCK CONFIGURATION SERVICE
// In a real microservice, this would be a dedicated service with its own database.

import { AgentConfiguration, InsertAgentConfiguration } from "@shared/schema";

interface AgentConfigStore {
  [businessId: number]: {
    [agentKey: string]: AgentConfiguration;
  };
}

const mockAgentConfigStore: AgentConfigStore = {
  1: { // Example businessId
    "billing_agent": {
      id: 1,
      businessId: 1,
      agentKey: "billing_agent",
      configJson: {
        business_name: "GreenFlow Lawn Care (Configured)",
        payment_link_base_url: "https://pay.greenflow.com/configured",
        include_late_fee_language: true,
        escalation_cadence_days: [5, 10, 15, 20],
        tone: "firm",
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any, // Cast to any to bypass strict type checking for mock
    "quoting_agent": {
      id: 2,
      businessId: 1,
      agentKey: "quoting_agent",
      configJson: {
        minimumPrice: 60,
        maxAutoQuoteUsd: 700,
        confidenceThreshold: 0.8,
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any,
  },
};

export const configurationService = {
  async getAgentConfig(businessId: number, agentKey: string): Promise<AgentConfiguration | undefined> {
    console.log(`MOCK: configurationService.getAgentConfig(${businessId}, ${agentKey})`);
    return mockAgentConfigStore[businessId]?.[agentKey];
  },

  async setAgentConfig(config: InsertAgentConfiguration): Promise<AgentConfiguration> {
    console.log(`MOCK: configurationService.setAgentConfig(${JSON.stringify(config)})`);
    if (!mockAgentConfigStore[config.businessId]) {
      mockAgentConfigStore[config.businessId] = {};
    }
    const newConfig = {
      id: Math.floor(Math.random() * 1000) + 100, // Mock ID
      ...config,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockAgentConfigStore[config.businessId][config.agentKey] = newConfig;
    return newConfig;
  },

  async updateAgentConfig(businessId: number, agentKey: string, updates: Partial<InsertAgentConfiguration>): Promise<AgentConfiguration | undefined> {
    console.log(`MOCK: configurationService.updateAgentConfig(${businessId}, ${agentKey}, ${JSON.stringify(updates)})`);
    const existing = mockAgentConfigStore[businessId]?.[agentKey];
    if (existing) {
      const updatedConfig = { ...existing, ...updates, updatedAt: new Date() };
      mockAgentConfigStore[businessId][agentKey] = updatedConfig;
      return updatedConfig;
    }
    return undefined;
  },

  // Add a helper to reset the store for tests if needed
  _resetMockStore() {
    Object.keys(mockAgentConfigStore).forEach(key => delete mockAgentConfigStore[Number(key)]);
    // Re-initialize with default mock data if desired
    Object.assign(mockAgentConfigStore, {
      1: {
        "billing_agent": {
          id: 1,
          businessId: 1,
          agentKey: "billing_agent",
          configJson: {
            business_name: "GreenFlow Lawn Care (Configured)",
            payment_link_base_url: "https://pay.greenflow.com/configured",
            include_late_fee_language: true,
            escalation_cadence_days: [5, 10, 15, 20],
            tone: "firm",
          },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
        "quoting_agent": {
          id: 2,
          businessId: 1,
          agentKey: "quoting_agent",
          configJson: {
            minimumPrice: 60,
            maxAutoQuoteUsd: 700,
            confidenceThreshold: 0.8,
          },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      },
    });
  }
};
