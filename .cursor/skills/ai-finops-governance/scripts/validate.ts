#!/usr/bin/env node
/**
 * AI FinOps Governance Validator
 * 
 * Checks codebase for compliance with AI governance guidelines:
 * - No hardcoded API keys
 * - Proper environment variable usage
 * - Token budget configuration
 * - Monitoring implementation
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

interface ValidationResult {
  pass: boolean;
  message: string;
  file?: string;
  line?: number;
}

class GovernanceValidator {
  private results: ValidationResult[] = [];
  private projectRoot: string;
  
  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }
  
  validate(): ValidationResult[] {
    console.log('🔍 Validating AI FinOps Governance...\n');
    
    this.checkForHardcodedKeys();
    this.checkEnvironmentConfig();
    this.checkMonitoringImplementation();
    this.checkSecretRedaction();
    
    return this.results;
  }
  
  private checkForHardcodedKeys() {
    console.log('Checking for hardcoded API keys...');
    
    const dangerousPatterns = [
      /sk-[a-zA-Z0-9]{20,}/g,              // OpenAI keys
      /sk-ant-[a-zA-Z0-9-]{20,}/g,         // Anthropic keys
      /apiKey:\s*["'][^"']+["']/g,         // Direct API key assignment
    ];
    
    const files = this.getSourceFiles(['.ts', '.js', '.tsx', '.jsx']);
    let foundIssues = false;
    
    files.forEach(file => {
      if (file.includes('node_modules') || file.includes('.env')) return;
      
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        dangerousPatterns.forEach(pattern => {
          if (pattern.test(line)) {
            foundIssues = true;
            this.results.push({
              pass: false,
              message: '❌ Hardcoded API key detected',
              file: relative(this.projectRoot, file),
              line: index + 1,
            });
          }
        });
      });
    });
    
    if (!foundIssues) {
      this.results.push({
        pass: true,
        message: '✅ No hardcoded API keys found',
      });
    }
  }
  
  private checkEnvironmentConfig() {
    console.log('Checking environment configuration...');
    
    const envConfigPath = join(this.projectRoot, 'src', 'config', 'env.ts');
    const altPaths = [
      join(this.projectRoot, 'config', 'env.ts'),
      join(this.projectRoot, 'server', 'config', 'env.ts'),
      join(this.projectRoot, 'agent-service', 'src', 'config', 'env.ts'),
    ];
    
    let foundConfig = false;
    const pathsToCheck = [envConfigPath, ...altPaths];
    
    for (const path of pathsToCheck) {
      try {
        const content = readFileSync(path, 'utf-8');
        
        // Check for zod validation
        if (content.includes('z.object') && content.includes('OPENAI_API_KEY')) {
          foundConfig = true;
          this.results.push({
            pass: true,
            message: '✅ Environment validation found',
            file: relative(this.projectRoot, path),
          });
          
          // Check for required fields
          const requiredFields = [
            'OPENAI_API_KEY',
            'OPENAI_MODEL',
            'DAILY_TOKEN_BUDGET',
          ];
          
          requiredFields.forEach(field => {
            if (!content.includes(field)) {
              this.results.push({
                pass: false,
                message: `⚠️  Missing recommended field: ${field}`,
                file: relative(this.projectRoot, path),
              });
            }
          });
          
          break;
        }
      } catch (err) {
        // File doesn't exist, continue
      }
    }
    
    if (!foundConfig) {
      this.results.push({
        pass: false,
        message: '❌ No environment validation config found (expected src/config/env.ts)',
      });
    }
  }
  
  private checkMonitoringImplementation() {
    console.log('Checking monitoring implementation...');
    
    const files = this.getSourceFiles(['.ts', '.js']);
    let hasTokenTracker = false;
    let hasLogging = false;
    
    files.forEach(file => {
      if (file.includes('node_modules')) return;
      
      const content = readFileSync(file, 'utf-8');
      
      if (content.includes('tokenTracker') || content.includes('TokenUsage')) {
        hasTokenTracker = true;
      }
      
      if (content.includes('logger.info') && content.includes('tokens')) {
        hasLogging = true;
      }
    });
    
    if (hasTokenTracker) {
      this.results.push({
        pass: true,
        message: '✅ Token tracking implementation found',
      });
    } else {
      this.results.push({
        pass: false,
        message: '⚠️  No token tracking found - implement src/lib/tokenTracker.ts',
      });
    }
    
    if (hasLogging) {
      this.results.push({
        pass: true,
        message: '✅ Token usage logging found',
      });
    }
  }
  
  private checkSecretRedaction() {
    console.log('Checking secret redaction...');
    
    const files = this.getSourceFiles(['.ts', '.js']);
    let hasRedaction = false;
    
    files.forEach(file => {
      if (file.includes('node_modules')) return;
      
      const content = readFileSync(file, 'utf-8');
      
      if (content.includes('redactSecrets') || content.includes('redact')) {
        hasRedaction = true;
      }
    });
    
    if (hasRedaction) {
      this.results.push({
        pass: true,
        message: '✅ Secret redaction implementation found',
      });
    } else {
      this.results.push({
        pass: false,
        message: '⚠️  No secret redaction found - implement src/lib/redact.ts',
      });
    }
  }
  
  private getSourceFiles(extensions: string[]): string[] {
    const files: string[] = [];
    
    const walk = (dir: string) => {
      try {
        const items = readdirSync(dir);
        
        items.forEach(item => {
          const fullPath = join(dir, item);
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            if (!item.startsWith('.') && item !== 'node_modules') {
              walk(fullPath);
            }
          } else if (extensions.some(ext => item.endsWith(ext))) {
            files.push(fullPath);
          }
        });
      } catch (err) {
        // Permission denied or doesn't exist
      }
    };
    
    walk(this.projectRoot);
    return files;
  }
  
  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Validation Results');
    console.log('='.repeat(60) + '\n');
    
    const passed = this.results.filter(r => r.pass).length;
    const failed = this.results.filter(r => !r.pass).length;
    
    this.results.forEach(result => {
      console.log(result.message);
      if (result.file) {
        console.log(`   ${result.file}${result.line ? `:${result.line}` : ''}`);
      }
    });
    
    console.log('\n' + '='.repeat(60));
    console.log(`✅ Passed: ${passed} | ❌ Failed: ${failed}`);
    console.log('='.repeat(60) + '\n');
    
    if (failed > 0) {
      console.log('⚠️  Some governance checks failed. Review the guidelines in:');
      console.log('   .cursor/skills/ai-finops-governance/SKILL.md\n');
      process.exit(1);
    } else {
      console.log('🎉 All governance checks passed!\n');
      process.exit(0);
    }
  }
}

// Run validation
const validator = new GovernanceValidator(process.cwd());
validator.validate();
validator.printResults();
