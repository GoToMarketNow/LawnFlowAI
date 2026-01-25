# Tool Contracts

## Communication Tools

### sendSMS
Send an SMS message to a customer.

**Input:**
```json
{
  "to": "string (phone number)",
  "message": "string (max 160 chars)",
  "priority": "normal|urgent" (optional)
}
```

**Output:**
```json
{
  "success": true,
  "messageId": "string",
  "error": "string" (if failed)
}
```

### sendEmail
Send an email to a customer.

**Input:**
```json
{
  "to": "string (email)",
  "subject": "string",
  "body": "string",
  "priority": "normal|urgent" (optional)
}
```

**Output:** Same as sendSMS

## Data Tools

### getCustomerHistory
Retrieve customer's interaction history.

**Input:**
```json
{
  "customerId": "string"
}
```

**Output:**
```json
{
  "customer": {...},
  "leads": [...],
  "quotes": [...],
  "jobs": [...],
  "communications": [...]
}
```

### updateCustomerMemory
Update customer's memory/profile.

**Input:**
```json
{
  "customerId": "string",
  "updates": {...}
}
```

**Output:**
```json
{
  "success": true
}
```

## Scheduling Tools

### checkAvailability
Check crew availability for a time slot.

**Input:**
```json
{
  "date": "YYYY-MM-DD",
  "startTime": "HH:MM",
  "duration": 60,
  "crew": "string" (optional)
}
```

**Output:**
```json
{
  "available": true,
  "crew": "string",
  "conflicts": [...]
}
```

### scheduleJob
Schedule a job.

**Input:**
```json
{
  "leadId": "string",
  "date": "YYYY-MM-DD",
  "startTime": "HH:MM",
  "crew": "string",
  "services": [...]
}
```

**Output:**
```json
{
  "jobId": "string",
  "success": true
}
```

## Geographic Tools

### geocodeAddress
Convert address to coordinates.

**Input:**
```json
{
  "address": "string"
}
```

**Output:**
```json
{
  "lat": 0.0,
  "lng": 0.0,
  "confidence": "high|medium|low"
}
```

### getParcelInfo
Get parcel information for coordinates.

**Input:**
```json
{
  "lat": 0.0,
  "lng": 0.0
}
```

**Output:**
```json
{
  "lotSize": 10000,
  "parcelId": "string",
  "confidence": "high|medium|low"
}
```

## Financial Tools

### calculateQuote
Calculate quote range.

**Input:**
```json
{
  "services": [...],
  "area": {...},
  "complexity": {...}
}
```

**Output:** QuoteResponse schema

### applyDiscount
Apply discount to a quote.

**Input:**
```json
{
  "quoteId": "string",
  "discountType": "percentage|fixed",
  "amount": 0.0,
  "reason": "string"
}
```

**Output:**
```json
{
  "newTotal": 0.0,
  "discountApplied": 0.0
}
```

## Error Handling
- All tools return success/error status
- Tools may throw exceptions for invalid inputs
- Network timeouts should be handled gracefully
- Rate limits should trigger backoff/retry logic