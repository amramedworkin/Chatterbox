# Script Type Rules for Chatterbox

## Overview
This project follows specific guidelines for script type selection, determining when to use shell scripts versus JavaScript/TypeScript scripts, and establishing TypeScript as the preferred language for new development.

## Script Type Selection Philosophy

### 1. TypeScript Preference (1.a.27)
- **TypeScript Preferred**: TypeScript is the preferred language for new development
- **Not Required**: TypeScript is not strictly required for all scripts
- **Gradual Migration**: Existing JavaScript scripts can be gradually migrated
- **Type Safety**: Leverage TypeScript's type safety features
- **Modern Development**: Use modern JavaScript/TypeScript features

### 2. Script Type Decision Framework
- **Functionality Requirements**: Choose based on required functionality
- **Performance Requirements**: Consider performance implications
- **Integration Requirements**: Consider integration with existing systems
- **Maintenance Requirements**: Consider long-term maintenance needs
- **Team Expertise**: Consider team expertise and familiarity

## Shell Scripts vs JavaScript Scripts (1.a.26)

### 1. Shell Script Use Cases
**Use Shell Scripts For:**
```bash
# System-level operations
- File system operations (copying, moving, deleting)
- Process management (starting, stopping, monitoring)
- Environment setup and configuration
- Package installation and management
- System administration tasks
- Quick automation scripts
- Deployment scripts that interact with system tools
- Scripts that need to run in minimal environments
```

**Shell Script Standards:**
```bash
#!/bin/bash

# Standard shell script template
set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Script metadata
SCRIPT_NAME="$(basename "$0")"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Logging functions
log_info() {
    echo "[INFO] $1"
}

log_error() {
    echo "[ERROR] $1" >&2
}

log_success() {
    echo "[SUCCESS] $1"
}

# Main function
main() {
    log_info "Starting $SCRIPT_NAME"
    
    # Script logic here
    
    log_success "$SCRIPT_NAME completed successfully"
}

# Execute main function
main "$@"
```

### 2. JavaScript/TypeScript Script Use Cases
**Use JavaScript/TypeScript Scripts For:**
```javascript
// Complex business logic
- Data processing and transformation
- API interactions and integrations
- Configuration management
- Complex automation workflows
- Testing and validation
- Reporting and analytics
- Integration with Node.js ecosystem
- Scripts requiring complex error handling
- Scripts with multiple dependencies
```

**JavaScript Script Standards:**
```javascript
#!/usr/bin/env node

/**
 * Script Name: [Script Name]
 * Purpose: [Brief description of purpose]
 * Author: [Author Name]
 * Date: [Creation Date]
 */

const fs = require('fs');
const path = require('path');

// Import required modules
const { config } = require('./config');
const { utils } = require('./utils');

// Configuration
const SCRIPT_CONFIG = {
    name: 'script-name',
    version: '1.0.0',
    description: 'Script description'
};

// Main function
async function main() {
    try {
        console.log(`Starting ${SCRIPT_CONFIG.name}`);
        
        // Script logic here
        
        console.log(`${SCRIPT_CONFIG.name} completed successfully`);
    } catch (error) {
        console.error(`Error in ${SCRIPT_CONFIG.name}:`, error);
        process.exit(1);
    }
}

// Execute main function
if (require.main === module) {
    main().catch((error) => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });
}

module.exports = { main };
```

**TypeScript Script Standards:**
```typescript
#!/usr/bin/env node

/**
 * Script Name: [Script Name]
 * Purpose: [Brief description of purpose]
 * Author: [Author Name]
 * Date: [Creation Date]
 */

import fs from 'fs';
import path from 'path';

// Import required modules
import { config } from './config';
import { utils } from './utils';

// Type definitions
interface ScriptConfig {
    name: string;
    version: string;
    description: string;
}

interface ScriptOptions {
    verbose?: boolean;
    dryRun?: boolean;
    config?: string;
}

// Configuration
const SCRIPT_CONFIG: ScriptConfig = {
    name: 'script-name',
    version: '1.0.0',
    description: 'Script description'
};

// Main function
async function main(options: ScriptOptions = {}): Promise<void> {
    try {
        console.log(`Starting ${SCRIPT_CONFIG.name}`);
        
        // Script logic here
        
        console.log(`${SCRIPT_CONFIG.name} completed successfully`);
    } catch (error) {
        console.error(`Error in ${SCRIPT_CONFIG.name}:`, error);
        process.exit(1);
    }
}

// Execute main function
if (require.main === module) {
    main().catch((error) => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });
}

export { main };
```

## Script Type Decision Matrix

### 1. Decision Criteria
```javascript
const scriptTypeDecisionMatrix = {
    // Use Shell Scripts When:
    shellScripts: {
        systemOperations: true,        // File system, process management
        minimalDependencies: true,     // No external dependencies
        quickAutomation: true,         // Simple automation tasks
        deploymentScripts: true,       // Deployment and setup scripts
        environmentSetup: true,        // Environment configuration
        crossPlatform: false,          // May not work on all platforms
        complexLogic: false,           // Limited logic capabilities
        errorHandling: false,          // Limited error handling
        testing: false,                // Limited testing capabilities
        maintenance: false             // Harder to maintain
    },
    
    // Use JavaScript/TypeScript When:
    javaScriptScripts: {
        complexLogic: true,            // Complex business logic
        dataProcessing: true,          // Data processing and transformation
        apiIntegration: true,          // API interactions
        errorHandling: true,           // Complex error handling
        testing: true,                 // Comprehensive testing
        maintenance: true,             // Easier to maintain
        typeSafety: true,              // TypeScript type safety
        ecosystem: true,               // Node.js ecosystem integration
        performance: true,             // Better performance for complex tasks
        debugging: true                // Better debugging capabilities
    }
};
```

### 2. Decision Flow
```javascript
function determineScriptType(requirements) {
    // Check for system-level operations
    if (requirements.systemOperations) {
        return 'shell';
    }
    
    // Check for complex logic
    if (requirements.complexLogic || requirements.dataProcessing) {
        return 'typescript';
    }
    
    // Check for API integration
    if (requirements.apiIntegration) {
        return 'typescript';
    }
    
    // Check for testing requirements
    if (requirements.testing) {
        return 'typescript';
    }
    
    // Default to TypeScript for new development
    return 'typescript';
}
```

## TypeScript Implementation Standards

### 1. TypeScript Configuration
```json
{
    "compilerOptions": {
        "target": "ES2020",
        "module": "commonjs",
        "lib": ["ES2020"],
        "outDir": "./dist",
        "rootDir": "./src",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "declaration": true,
        "declarationMap": true,
        "sourceMap": true,
        "removeComments": false,
        "noImplicitAny": true,
        "noImplicitReturns": true,
        "noFallthroughCasesInSwitch": true,
        "noUncheckedIndexedAccess": true
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### 2. TypeScript Best Practices
```typescript
// Use strict typing
interface User {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
}

// Use async/await for asynchronous operations
async function processUser(user: User): Promise<void> {
    try {
        const result = await validateUser(user);
        await saveUser(result);
    } catch (error) {
        throw new Error(`Failed to process user: ${error.message}`);
    }
}

// Use proper error handling
class ScriptError extends Error {
    constructor(message: string, public code: string) {
        super(message);
        this.name = 'ScriptError';
    }
}

// Use configuration interfaces
interface ScriptConfig {
    input: string;
    output: string;
    options: {
        verbose: boolean;
        dryRun: boolean;
    };
}
```

## Script Organization and Structure

### 1. Directory Structure
```
scripts/
├── shell/                    # Shell scripts
│   ├── deployment/          # Deployment scripts
│   ├── setup/              # Setup scripts
│   ├── maintenance/        # Maintenance scripts
│   └── utilities/          # Utility scripts
├── typescript/              # TypeScript scripts
│   ├── data-processing/    # Data processing scripts
│   ├── api-integration/    # API integration scripts
│   ├── automation/         # Automation scripts
│   └── utilities/          # Utility scripts
└── javascript/              # JavaScript scripts (legacy)
    ├── legacy/             # Legacy scripts
    └── migration/          # Migration scripts
```

### 2. Naming Conventions
```javascript
// Shell scripts
deploy-infrastructure.sh
setup-environment.sh
backup-database.sh
cleanup-temp-files.sh

// TypeScript scripts
processUserData.ts
integrateWithAPI.ts
generateReport.ts
validateConfiguration.ts

// JavaScript scripts (legacy)
legacy-data-migration.js
old-automation-script.js
```

## Script Testing and Quality Assurance

### 1. Shell Script Testing
```bash
#!/bin/bash

# Shell script testing template
test_script() {
    local test_name="$1"
    local expected_output="$2"
    local actual_output
    
    actual_output=$(./script.sh)
    
    if [ "$actual_output" = "$expected_output" ]; then
        echo "✅ $test_name passed"
    else
        echo "❌ $test_name failed"
        echo "Expected: $expected_output"
        echo "Actual: $actual_output"
        exit 1
    fi
}

# Run tests
test_script "Basic functionality" "expected output"
```

### 2. TypeScript Script Testing
```typescript
// TypeScript script testing
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { main } from './script';

describe('Script Tests', () => {
    beforeEach(() => {
        // Setup test environment
    });
    
    afterEach(() => {
        // Cleanup test environment
    });
    
    it('should process data correctly', async () => {
        const result = await main({ input: 'test-data' });
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
    });
    
    it('should handle errors gracefully', async () => {
        await expect(main({ input: 'invalid-data' }))
            .rejects.toThrow('Invalid input data');
    });
});
```

## Script Migration and Maintenance

### 1. Migration Strategy
```javascript
const migrationStrategy = {
    // Phase 1: Identify candidates for migration
    phase1: {
        criteria: [
            'Complex logic',
            'Frequent changes',
            'Poor error handling',
            'Limited testing'
        ],
        priority: 'high'
    },
    
    // Phase 2: Create TypeScript versions
    phase2: {
        steps: [
            'Create TypeScript version',
            'Add comprehensive tests',
            'Improve error handling',
            'Add type safety'
        ],
        priority: 'medium'
    },
    
    // Phase 3: Replace shell scripts
    phase3: {
        steps: [
            'Deploy TypeScript version',
            'Update documentation',
            'Remove shell script',
            'Update references'
        ],
        priority: 'low'
    }
};
```

### 2. Maintenance Standards
- **Regular Review**: Review scripts regularly for improvements
- **Dependency Updates**: Keep dependencies updated
- **Security Audits**: Regular security audits of scripts
- **Performance Monitoring**: Monitor script performance
- **Documentation Updates**: Keep documentation updated

## Script Documentation Standards

### 1. Script Documentation Template
```javascript
/**
 * Script Name: [Script Name]
 * Type: [Shell/JavaScript/TypeScript]
 * Purpose: [Brief description of purpose]
 * 
 * Usage:
 * ```bash
 * # Shell script
 * ./script.sh [options]
 * 
 * # JavaScript/TypeScript script
 * node script.js [options]
 * ```
 * 
 * Options:
 * - --help: Show help information
 * - --verbose: Enable verbose output
 * - --dry-run: Perform dry run
 * 
 * Dependencies:
 * - [List of dependencies]
 * 
 * Examples:
 * ```bash
 * # Example usage
 * ./script.sh --verbose --dry-run
 * ```
 * 
 * Error Handling:
 * - [List of error conditions and handling]
 * 
 * Testing:
 * - [Testing instructions]
 * 
 * Maintenance:
 * - [Maintenance instructions]
 */
```

### 2. Documentation Requirements
- **Purpose**: Clear description of script purpose
- **Usage**: Detailed usage instructions
- **Options**: Complete list of options and parameters
- **Examples**: Practical usage examples
- **Error Handling**: Error conditions and handling
- **Testing**: Testing instructions and examples
- **Maintenance**: Maintenance and update procedures

This comprehensive approach ensures appropriate script type selection, maintains code quality, and provides clear guidelines for script development and maintenance. 