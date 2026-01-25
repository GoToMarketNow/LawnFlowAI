# JSON Schemas

## Common Schemas

### Address
```json
{
  "type": "object",
  "properties": {
    "street": {"type": "string"},
    "city": {"type": "string"},
    "state": {"type": "string"},
    "zip": {"type": "string"},
    "country": {"type": "string", "default": "US"}
  },
  "required": ["street", "city", "state", "zip"]
}
```

### Service Request
```json
{
  "type": "object",
  "properties": {
    "services": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["mowing", "edging", "trimming", "fertilizing", "aeration", "seeding", "mulching", "cleanup"]
      }
    },
    "frequency": {
      "type": "string",
      "enum": ["weekly", "biweekly", "monthly", "seasonal", "one-time"]
    },
    "area": {
      "type": "object",
      "properties": {
        "sqft": {"type": "number"},
        "band": {"type": "string", "enum": ["small", "medium", "large", "xlarge"]}
      }
    },
    "complexity": {
      "type": "object",
      "properties": {
        "slope": {"type": "string", "enum": ["flat", "moderate", "steep"]},
        "access": {"type": "string", "enum": ["easy", "moderate", "difficult"]},
        "obstacles": {"type": "array", "items": {"type": "string"}}
      }
    }
  },
  "required": ["services", "frequency"]
}
```

### Quote Response
```json
{
  "type": "object",
  "properties": {
    "low": {"type": "number"},
    "high": {"type": "number"},
    "currency": {"type": "string", "default": "USD"},
    "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
    "assumptions": {"type": "array", "items": {"type": "string"}},
    "lineItems": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "service": {"type": "string"},
          "quantity": {"type": "number"},
          "unit": {"type": "string"},
          "rate": {"type": "number"},
          "total": {"type": "number"}
        }
      }
    },
    "nextSteps": {"type": "array", "items": {"type": "string"}}
  },
  "required": ["low", "high", "confidence"]
}
```

### Schedule Slot
```json
{
  "type": "object",
  "properties": {
    "date": {"type": "string", "format": "date"},
    "startTime": {"type": "string", "format": "time"},
    "endTime": {"type": "string", "format": "time"},
    "crew": {"type": "string"},
    "availability": {"type": "string", "enum": ["available", "preferred", "limited"]}
  },
  "required": ["date", "startTime", "endTime"]
}
```

## Validation Rules
- All monetary values in cents (integer) to avoid floating point issues
- Dates in ISO 8601 format (YYYY-MM-DD)
- Times in 24-hour format (HH:MM)
- Use enums for controlled vocabularies
- Include optional fields for extensibility