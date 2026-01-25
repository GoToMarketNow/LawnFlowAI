# Service Layer Guidelines

## Objective
To establish a clear and consistent service layer architecture within the LawnFlow monolith and all microservices (e.g., `agent-service`). This layer will encapsulate business logic, improve separation of concerns, reduce code duplication, and enhance maintainability, testability, and scalability.

## Purpose of a Service Layer
The service layer sits between the application's presentation/API layer (e.g., Express routes, UI components) and its data access layer (e.g., ORM, external APIs). Its primary responsibilities include:

1.  **Encapsulating Business Logic:** Contains the core rules, workflows, and policies of the application.
2.  **Orchestrating Operations:** Coordinates calls to multiple data sources or external services to fulfill a business operation.
3.  **Transaction Management:** Manages atomic operations across multiple data stores (though in microservices, this often shifts to sagas/orchestration).
4.  **Abstraction of Data Access:** Provides a higher-level API than direct repository/ORM calls, shielding the presentation layer from database specifics.
5.  **Reusability:** Business logic can be reused across different entry points (APIs, CLI commands, message queues).
6.  **Testability:** Easier to unit test business logic in isolation from the presentation and data layers.

## Service Layer Structure

A typical service module should adhere to the following structure:

```typescript
// agent-service/src/services/exampleService.ts

import { SomeRepository } from '../data/someRepository'; // Data Access Layer
import { OtherService } from './otherService'; // Other Service dependency
import { validateInputSchema } from '../utils/validation'; // Utility/Helper

interface ExampleServiceInput {
  // Define input types
}

interface ExampleServiceOutput {
  // Define output types
}

class ExampleService {
  constructor(
    private someRepository: SomeRepository,
    private otherService: OtherService,
    // Inject other dependencies (e.g., logger, metrics client)
  ) {}

  /**
   * Performs a specific business operation.
   * @param input The validated input for this operation.
   * @returns The result of the operation.
   */
  async performOperation(input: ExampleServiceInput): Promise<ExampleServiceOutput> {
    // 1. Input Validation (if not already done by API layer, or for complex business rules)
    validateInputSchema(input);

    // 2. Fetch/Transform Data (via repositories or other services)
    const data = await this.someRepository.getData(input.id);

    // 3. Apply Business Logic
    if (!data || data.status === 'invalid') {
      throw new Error('Invalid data for operation');
    }
    const processedData = this.applyBusinessRules(data, input);

    // 4. Orchestrate further actions (calling other services or repositories)
    const result = await this.otherService.process(processedData);

    // 5. Return Result
    return { success: true, ...result };
  }

  // Private helper methods for complex business rules
  private applyBusinessRules(data: any, input: ExampleServiceInput): any {
    // ... complex logic ...
    return data;
  }
}

// Export a singleton instance (or use dependency injection framework)
export const exampleService = new ExampleService(
  new SomeRepository(), // Instantiate dependencies (or resolve via DI)
  otherService,
);
```

### Key Characteristics of a Service Module:

*   **Single Responsibility Principle (SRP):** Each service should have one primary responsibility or domain of business logic.
*   **Dependency Injection:** Services should receive their dependencies (repositories, other services, utilities) through their constructor. This improves testability and modularity.
*   **No Direct HTTP/API Handling:** Services should not directly handle HTTP requests/responses. That's the job of the API/presentation layer.
*   **No Direct Database Access:** Services should interact with data only through a dedicated data access layer (e.g., repositories, ORMs abstracted by a `storage` module).
*   **Input Validation:** Perform business-level validation of inputs (schema validation might be done at the API layer, but business rules need to be checked here).
*   **Clear Contracts:** Explicitly define input and output types for all public methods.

## Interaction with `agent-service`

Within the `agent-service`, agents themselves (`Agent` interface implementations) can be thought of as a specialized type of "service" that encapsulates a specific AI-driven workflow. They will, in turn, utilize the more traditional "utility services" defined in `agent-service/src/services` (e.g., `geoService`, `configurationService`).

*   **Agents call Services:** An `Agent` implementation (e.g., `BillingAgent`) will call methods on other "utility services" (e.g., `configurationService.getAgentConfig`, `storage.getInvoice`).
*   **Services call Repositories (or `storage`):** The "utility services" will interact with the data access layer (e.g., our mocked `storage` for now).

## Guidelines for New Services

1.  **Identify Domain:** Determine the specific business domain or cross-cutting concern the service will address (e.g., `UserService`, `OrderService`, `NotificationService`, `GeoService`).
2.  **Define Interface:** If applicable, define a TypeScript interface for the service to ensure clear contracts and allow for mock implementations in tests.
3.  **Implement Logic:** Write clean, focused code to implement the business logic.
4.  **Inject Dependencies:** Explicitly declare and inject all dependencies.
5.  **Test Thoroughly:** Write unit and integration tests for all public methods.

## Example: Refining `agent-service/src/agents/billing.ts` with a Service Layer

Currently, `billing.ts` contains `runBillingAgent`, `runInvoiceBuildAgent`, `runReconciliationWorker`, etc. These are essentially functions that *perform* business logic. A formal service layer would organize these into a class.

```typescript
// agent-service/src/services/billingService.ts (New)

import { storage } from '../storage';
import { configurationService } from './configuration';
import { QuickBooksClient } from '../agents/billing'; // Assuming this gets moved or abstracted
import type { BillingAction, InvoiceData, CustomerHistory, BillingConfig, PolicyThresholds, InvoiceBuildResult, JobDataForInvoice, PricingRules } from "@shared/schema"; // Or specific types needed

// Function to determine escalation step (could be a utility or private method)
function determineEscalationStep(...) { /* ... */ }

// Function to check for human handoff (could be a utility or private method)
function shouldHandoffToHuman(...) { /* ... */ }

// Function to sanitize message (could be a utility or private method)
function sanitizeMessage(...) { /* ... */ }

// Function to remove late fee language (could be a utility or private method)
function removeLateFeeLanguage(...) { /* ... */ }

class BillingService {
  constructor(
    private storage: typeof storage, // Inject storage dependency
    private configService: typeof configurationService, // Inject config service dependency
    // Add other dependencies as needed
  ) {}

  async processBillingReminder(businessId: number, invoice: InvoiceData, history: CustomerHistory): Promise<BillingAction> {
    const config = (await this.configService.getAgentConfig(businessId, "billing_agent"))?.configJson as BillingConfig;
    const policy = (await this.configService.getAgentConfig(businessId, "policy_agent"))?.configJson as PolicyThresholds;

    if (!config || !policy) {
      throw new Error(`Billing agent configuration or policy not found for businessId ${businessId}.`);
    }

    // Existing logic from runBillingAgent, using 'config' and 'policy'
    const escalationStep = determineEscalationStep(invoice.days_overdue, config.escalation_cadence_days);
    const handoffCheck = shouldHandoffToHuman(invoice, history, escalationStep, policy.max_auto_followups);

    if (handoffCheck.handoff) {
      return { /* ... handoff action ... */ } as BillingAction;
    }

    // Call OpenAI and process response
    // ...
    return { /* ... processed action ... */ } as BillingAction;
  }

  async buildInvoice(businessId: number, job: JobDataForInvoice, accountId: number): Promise<InvoiceBuildResult> {
    const businessConfig = await this.storage.getBusinessProfile(businessId);
    if (!businessConfig) {
      throw new Error(`Business profile not found for businessId ${businessId}.`);
    }
    const businessName = businessConfig.name;

    const pricingConfig = (await this.configService.getAgentConfig(businessId, "pricing_rules"))?.configJson as PricingRules;
    if (!pricingConfig) {
      throw new Error(`Pricing rules configuration not found for businessId ${businessId}.`);
    }
    const pricing = pricingConfig;

    // Existing logic from runInvoiceBuildAgent
    // ...
    return { success: true } as InvoiceBuildResult;
  }

  async syncQuickBooksInvoice(accountId: number, invoiceId: number): Promise<any> {
    // Existing logic from runInvoiceSyncAgent
    // ...
    return { success: true };
  }
  
  // Expose other public methods for reconciliation, payment sync, etc.
}

export const billingService = new BillingService(storage, configurationService);
```

This approach helps organize the business logic, makes agents thinner wrappers around these services, and prepares the groundwork for truly separate microservices by defining clear functional boundaries.
