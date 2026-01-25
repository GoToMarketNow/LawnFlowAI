// Mock FSM (Field Service Management) Connector
// This simulates integration with Jobber/Housecall Pro/Service Autopilot
// Replace with actual API integrations when needed.

export interface FSMCustomer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface FSMJob {
  id: string;
  customerId: string;
  serviceType: string;
  scheduledDate: Date;
  estimatedPrice: number;
  status: "pending" | "scheduled" | "in_progress" | "completed" | "cancelled";
  notes?: string;
}

export interface FSMQuote {
  id: string;
  customerId: string;
  serviceType: string;
  estimatedPrice: number;
  validUntil: Date;
  status: "pending" | "accepted" | "rejected" | "expired";
}

class MockFSMConnector {
  private customers: Map<string, FSMCustomer> = new Map();
  private jobs: Map<string, FSMJob> = new Map();
  private quotes: Map<string, FSMQuote> = new Map();

  // Customer operations
  async createCustomer(customer: Omit<FSMCustomer, "id">): Promise<FSMCustomer> {
    const id = `cust_${Date.now().toString(36)}`;
    const newCustomer: FSMCustomer = { id, ...customer };
    this.customers.set(id, newCustomer);
    console.log(`[Mock FSM] Created customer: ${newCustomer.name} (${id})`);
    return newCustomer;
  }

  async findCustomerByPhone(phone: string): Promise<FSMCustomer | undefined> {
    return Array.from(this.customers.values()).find(
      (c) => c.phone.replace(/\D/g, "") === phone.replace(/\D/g, "")
    );
  }

  async getCustomer(id: string): Promise<FSMCustomer | undefined> {
    return this.customers.get(id);
  }

  // Quote operations
  async createQuote(
    customerId: string,
    serviceType: string,
    estimatedPrice: number
  ): Promise<FSMQuote> {
    const id = `quote_${Date.now().toString(36)}`;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 7);

    const quote: FSMQuote = {
      id,
      customerId,
      serviceType,
      estimatedPrice,
      validUntil,
      status: "pending",
    };

    this.quotes.set(id, quote);
    console.log(`[Mock FSM] Created quote: ${id} for $${(estimatedPrice / 100).toFixed(2)}`);
    return quote;
  }

  async acceptQuote(quoteId: string): Promise<FSMQuote | undefined> {
    const quote = this.quotes.get(quoteId);
    if (quote) {
      quote.status = "accepted";
      console.log(`[Mock FSM] Quote accepted: ${quoteId}`);
    }
    return quote;
  }

  // Job operations
  async createJob(
    customerId: string,
    serviceType: string,
    scheduledDate: Date,
    estimatedPrice: number,
    notes?: string
  ): Promise<FSMJob> {
    const id = `job_${Date.now().toString(36)}`;

    const job: FSMJob = {
      id,
      customerId,
      serviceType,
      scheduledDate,
      estimatedPrice,
      status: "scheduled",
      notes,
    };

    this.jobs.set(id, job);
    console.log(`[Mock FSM] Created job: ${id} scheduled for ${scheduledDate.toLocaleDateString()}`);
    return job;
  }

  async updateJobStatus(
    jobId: string,
    status: FSMJob["status"]
  ): Promise<FSMJob | undefined> {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = status;
      console.log(`[Mock FSM] Job ${jobId} status updated to: ${status}`);
    }
    return job;
  }

  async getJobsByCustomer(customerId: string): Promise<FSMJob[]> {
    return Array.from(this.jobs.values()).filter((j) => j.customerId === customerId);
  }

  // Scheduling utilities
  getNextAvailableSlot(): Date {
    // Mock: return next available slot (tomorrow at 9 AM)
    const slot = new Date();
    slot.setDate(slot.getDate() + 1);
    slot.setHours(9, 0, 0, 0);
    return slot;
  }

  getAvailableSlots(days: number = 7): Date[] {
    const slots: Date[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      // Add morning and afternoon slots
      const morning = new Date(date);
      morning.setHours(9, 0, 0, 0);
      slots.push(morning);

      const afternoon = new Date(date);
      afternoon.setHours(14, 0, 0, 0);
      slots.push(afternoon);
    }

    return slots;
  }

  // Pricing utilities
  estimatePrice(serviceType: string, details?: string): number {
    // Mock pricing based on service type (in cents)
    const basePrices: Record<string, number> = {
      "lawn mowing": 7500, // $75
      "lawn care": 7500,
      "landscaping": 25000, // $250
      "tree trimming": 15000, // $150
      "hedge trimming": 10000, // $100
      "leaf removal": 12500, // $125
      "mulching": 20000, // $200
      "garden maintenance": 8500, // $85
      "irrigation": 30000, // $300
      "default": 10000, // $100
    };

    const normalizedType = serviceType.toLowerCase();
    let price = basePrices.default;

    for (const [key, value] of Object.entries(basePrices)) {
      if (normalizedType.includes(key)) {
        price = value;
        break;
      }
    }

    // Add some variance
    const variance = Math.floor(Math.random() * 2000) - 1000;
    return Math.max(5000, price + variance);
  }
}

export const fsmConnector = new MockFSMConnector();
