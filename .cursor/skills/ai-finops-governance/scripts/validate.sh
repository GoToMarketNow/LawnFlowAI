#!/bin/bash
# AI FinOps Governance Validator
# Run this before commits or deploys to ensure compliance

echo "Running AI FinOps Governance validation..."
npx tsx .cursor/skills/ai-finops-governance/scripts/validate.ts
