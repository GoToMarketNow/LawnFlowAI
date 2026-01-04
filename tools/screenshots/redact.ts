import { Page } from 'playwright';

/**
 * CSS styles to inject for PII redaction mode
 * Masks emails, phone numbers, names, and addresses with black bars
 */
const REDACTION_CSS = `
  /* Redact phone numbers (common patterns) */
  [data-testid*="phone"],
  [data-testid*="Phone"],
  .phone-number,
  td:has(a[href^="tel:"]),
  a[href^="tel:"] {
    position: relative;
    color: transparent !important;
  }
  [data-testid*="phone"]::after,
  [data-testid*="Phone"]::after,
  .phone-number::after,
  a[href^="tel:"]::after {
    content: "***-***-****";
    position: absolute;
    left: 0;
    top: 0;
    color: inherit;
    background: #000;
    padding: 0 4px;
    border-radius: 2px;
    color: #000;
  }

  /* Redact email addresses */
  [data-testid*="email"],
  [data-testid*="Email"],
  .email-address,
  a[href^="mailto:"] {
    position: relative;
    color: transparent !important;
  }
  [data-testid*="email"]::after,
  [data-testid*="Email"]::after,
  .email-address::after,
  a[href^="mailto:"]::after {
    content: "***@***.com";
    position: absolute;
    left: 0;
    top: 0;
    background: #000;
    padding: 0 4px;
    border-radius: 2px;
    color: #000;
  }

  /* Redact customer names in tables and lists */
  [data-testid*="customer-name"],
  [data-testid*="customerName"],
  .customer-name {
    position: relative;
  }
  [data-testid*="customer-name"]::before,
  [data-testid*="customerName"]::before,
  .customer-name::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background: repeating-linear-gradient(
      90deg,
      #333 0px,
      #333 8px,
      #555 8px,
      #555 12px
    );
    border-radius: 2px;
  }

  /* Redact addresses */
  [data-testid*="address"],
  [data-testid*="Address"],
  .street-address,
  .property-address {
    filter: blur(4px);
  }

  /* Generic redaction class */
  .pii-redact {
    filter: blur(4px) !important;
    user-select: none !important;
  }

  /* Redact SMS message content */
  [data-testid*="message-body"],
  [data-testid*="sms-content"],
  .message-content {
    filter: blur(3px);
  }

  /* Mask specific dollar amounts (optional) */
  .redact-amounts [data-testid*="amount"],
  .redact-amounts [data-testid*="price"],
  .redact-amounts [data-testid*="total"] {
    filter: blur(3px);
  }
`;

/**
 * Inject redaction CSS into the page
 */
export async function injectRedactionStyles(page: Page): Promise<void> {
  await page.addStyleTag({ content: REDACTION_CSS });
  console.log('[Redact] Injected PII redaction styles');
}

/**
 * Apply redaction to specific elements by selector
 */
export async function redactElements(page: Page, selectors: string[]): Promise<void> {
  for (const selector of selectors) {
    try {
      const elements = await page.$$(selector);
      for (const element of elements) {
        await element.evaluate((el) => {
          el.classList.add('pii-redact');
        });
      }
    } catch (e) {
      // Selector not found, continue
    }
  }
}

/**
 * Build URL with redaction query param
 */
export function buildRedactedUrl(baseUrl: string, route: string, redact: boolean): string {
  const url = new URL(route, baseUrl);
  if (redact) {
    url.searchParams.set('redact', '1');
  }
  return url.toString();
}
