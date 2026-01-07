// MOCK STORAGE
// In a real microservice, this would be a connection to a database or other storage service.

export const storage = {
  getAccountIntegration: async (accountId: number, provider: string) => {
    console.log(`MOCK: getAccountIntegration(${accountId}, ${provider})`);
    return undefined;
  },
  getInvoice: async (invoiceId: number) => {
    console.log(`MOCK: getInvoice(${invoiceId})`);
    return undefined;
  },
  updateInvoice: async (invoiceId: number, updates: any) => {
    console.log(`MOCK: updateInvoice(${invoiceId}, ${JSON.stringify(updates)})`);
    return {} as any;
  },
  getInvoiceLineItems: async (invoiceId: number) => {
    console.log(`MOCK: getInvoiceLineItems(${invoiceId})`);
    return [];
  },
  createInvoice: async (invoice: any) => {
    console.log(`MOCK: createInvoice(${JSON.stringify(invoice)})`);
    return {} as any;
  },
  createInvoiceLineItem: async (item: any) => {
    console.log(`MOCK: createInvoiceLineItem(${JSON.stringify(item)})`);
    return {} as any;
  },
  getInvoices: async (accountId: number, options?: any) => {
    console.log(`MOCK: getInvoices(${accountId}, ${JSON.stringify(options)})`);
    return [];
  },
  getPayments: async (accountId: number, options?: any) => {
    console.log(`MOCK: getPayments(${accountId}, ${JSON.stringify(options)})`);
    return [];
  },
  getBillingIssues: async (accountId: number, options?: any) => {
    console.log(`MOCK: getBillingIssues(${accountId}, ${JSON.stringify(options)})`);
    return [];
  },
  createBillingIssue: async (issue: any) => {
    console.log(`MOCK: createBillingIssue(${JSON.stringify(issue)})`);
    return {} as any;
  },
  getCustomer: async (customerId: number) => {
    console.log(`MOCK: getCustomer(${customerId})`);
    return undefined;
  },
  getBusinessProfile: async (accountId?: number) => {
    console.log(`MOCK: getBusinessProfile(${accountId})`);
    return {
        id: 1,
        name: "Green Ridge Lawn Care",
        phone: "+14345551234",
        email: "info@greenridgelawncare.com",
    } as any;
  },
  getCrewMembers: async (crewId: number) => {
    console.log(`MOCK: getCrewMembers(${crewId})`);
    return [];
  },
  getUserById: async (userId: number) => {
    console.log(`MOCK: getUserById(${userId})`);
    return {id: userId, role: 'admin'} as any;
  },
  getJobRequest: async (jobRequestId: number) => {
    console.log(`MOCK: getJobRequest(${jobRequestId})`);
    return undefined;
  },
  getSimulation: async (simulationId: number) => {
    console.log(`MOCK: getSimulation(${simulationId})`);
    return undefined;
  },
  getCrew: async (crewId: number) => {
    console.log(`MOCK: getCrew(${crewId})`);
    return undefined;
  },
  getSimulationsForJobRequest: async (jobRequestId: number) => {
    console.log(`MOCK: getSimulationsForJobRequest(${jobRequestId})`);
    return [];
  },
  createDecision: async (decision: any) => {
    console.log(`MOCK: createDecision(${JSON.stringify(decision)})`);
    return {} as any;
  },
  updateJobRequest: async (jobRequestId: number, updates: any) => {
    console.log(`MOCK: updateJobRequest(${jobRequestId}, ${JSON.stringify(updates)})`);
    return {} as any;
  },
  updateDecision: async (decisionId: number, updates: any) => {
    console.log(`MOCK: updateDecision(${decisionId}, ${JSON.stringify(updates)})`);
    return {} as any;
  },
  getDecision: async (decisionId: number) => {
    console.log(`MOCK: getDecision(${decisionId})`);
    return undefined;
  },
  getCustomerServicePreferences: async (accountId: number, customerId: number) => {
    console.log(`MOCK: getCustomerServicePreferences(${accountId}, ${customerId})`);
    return [];
  },
  upsertCustomerServicePreference: async (pref: any) => {
    console.log(`MOCK: upsertCustomerServicePreference(${JSON.stringify(pref)})`);
    return {} as any;
  },
  getService: async (serviceId: number) => {
    console.log(`MOCK: getService(${serviceId})`);
    return undefined;
  },
  getServicePricing: async (serviceId: number) => {
    console.log(`MOCK: getServicePricing(${serviceId})`);
    return [];
  },
  getServiceFrequencyOptions: async (serviceId: number) => {
    console.log(`MOCK: getServiceFrequencyOptions(${serviceId})`);
    return [];
  },
  getSnowServicePolicy: async (serviceId: number) => {
    console.log(`MOCK: getSnowServicePolicy(${serviceId})`);
    return undefined;
  },
  getPromotionRules: async (accountId: number, options?: any) => {
    console.log(`MOCK: getPromotionRules(${accountId}, ${JSON.stringify(options)})`);
    return [];
  },
  getDistanceCache: async (originKey: string, destKey: string) => {
    console.log(`MOCK: getDistanceCache(${originKey}, ${destKey})`);
    return undefined;
  },
  upsertDistanceCache: async (entry: any) => {
    console.log(`MOCK: upsertDistanceCache(${JSON.stringify(entry)})`);
    return {} as any;
  },
  deleteDecisionsForJobRequest: async (jobRequestId: number) => {
    console.log(`MOCK: deleteDecisionsForJobRequest(${jobRequestId})`);
  },
  deleteSimulationsForJobRequest: async (jobRequestId: number) => {
    console.log(`MOCK: deleteSimulationsForJobRequest(${jobRequestId})`);
  },
  createSimulation: async (sim: any) => {
    console.log(`MOCK: createSimulation(${JSON.stringify(sim)})`);
    return {} as any;
  },
  getServices: async (accountId: number, options?: any) => {
    console.log(`MOCK: getServices(${accountId}, ${JSON.stringify(options)})`);
    return [];
  },
  getQuotes: async (accountId: number) => {
    console.log(`MOCK: getQuotes(${accountId})`);
    return [];
  },
  getJobs: async (accountId: number) => {
    console.log(`MOCK: getJobs(${accountId})`);
    return [];
  },
  getCrews: async (accountId: number) => {
    console.log(`MOCK: getCrews(${accountId})`);
    return [];
  },
  getServiceZones: async (accountId: number) => {
    console.log(`MOCK: getServiceZones(${accountId})`);
    return [];
  },
  getCustomers: async (accountId: number) => {
    console.log(`MOCK: getCustomers(${accountId})`);
    return [];
  },
  // New mock methods for crewIntelligence.ts
  getScheduleItemsForCrewAndDate: async (businessId: number, crewId: number, date: string) => {
    console.log(`MOCK: getScheduleItemsForCrewAndDate(${businessId}, ${crewId}, ${date})`);
    return [];
  },
  getCrewMembersCount: async (crewId: number) => {
    console.log(`MOCK: getCrewMembersCount(${crewId})`);
    return 1; // Default to 1 member
  }
};
