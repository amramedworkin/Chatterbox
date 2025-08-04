# Package.json Script Rules for Chatterbox

## Overview
This project follows comprehensive standards for package.json script organization, naming conventions, and management. All system operations are accessible through npm scripts, providing a centralized and consistent interface for development and operations.

## Package.json Script Philosophy (1.a.28)

### 1. Centralized Script Management
- **Single Source of Truth**: All scripts defined in package.json
- **Consistent Interface**: Uniform interface for all operations
- **Discoverability**: Easy to discover and understand available operations
- **Documentation**: Self-documenting through clear naming and descriptions
- **Maintainability**: Centralized management and updates

### 2. Script Organization Principles
- **Logical Grouping**: Group related scripts by functionality
- **Hierarchical Naming**: Use hierarchical naming conventions
- **Consistent Patterns**: Follow consistent patterns across all scripts
- **Clear Descriptions**: Provide clear descriptions for all scripts
- **Comprehensive Coverage**: Cover all system operations

## Script Naming Standards (1.a.28.i)

### 1. Naming Convention Format
```javascript
// Format: category:subcategory:operation
// Examples:
"aws:deploy:complete"     // AWS deployment complete operation
"aws:lambda:build"        // AWS Lambda build operation
"mail:auth:force"         // Mail authentication force operation
"test:unit:all"           // Unit test all operation
"clean:local:system"      // Local system cleanup operation
```

### 2. Category Prefixes
```javascript
const scriptCategories = {
    // Build and deployment
    'build': 'Build operations',
    'deploy': 'Deployment operations',
    'teardown': 'Teardown operations',
    
    // Cloud services
    'aws': 'AWS operations',
    'azure': 'Azure operations',
    'gcp': 'Google Cloud operations',
    
    // System operations
    'mail': 'Mail system operations',
    'test': 'Testing operations',
    'clean': 'Cleanup operations',
    'validate': 'Validation operations',
    'backup': 'Backup operations',
    'restore': 'Restore operations',
    
    // Development
    'dev': 'Development operations',
    'lint': 'Linting operations',
    'format': 'Formatting operations',
    
    // Utilities
    'menu': 'Menu system operations',
    'help': 'Help and documentation',
    'init': 'Initialization operations'
};
```

### 3. Subcategory Standards
```javascript
const subcategoryExamples = {
    // AWS subcategories
    'aws:deploy': 'AWS deployment operations',
    'aws:lambda': 'AWS Lambda operations',
    'aws:ses': 'AWS SES operations',
    'aws:validate': 'AWS validation operations',
    'aws:cleanup': 'AWS cleanup operations',
    
    // Mail subcategories
    'mail:auth': 'Mail authentication operations',
    'mail:poll': 'Mail polling operations',
    'mail:send': 'Mail sending operations',
    'mail:process': 'Mail processing operations',
    
    // Test subcategories
    'test:unit': 'Unit testing operations',
    'test:integration': 'Integration testing operations',
    'test:e2e': 'End-to-end testing operations',
    'test:performance': 'Performance testing operations'
};
```

## Script Organization and Structure

### 1. Script Grouping Standards
```json
{
  "scripts": {
    "build": "tsc && mkdir -p dist/tokensite && cp -R src/html dist/tokensite",
    "build:clean": "rimraf dist && npm run build",
    "clean": "rimraf dist",
    "format": "prettier --write \"{src,test}/**/*.ts\"",
    "lint": "eslint \"{src,test,scripts}/**/*.{ts,js}\" --cache --fix",
    "lint:check": "eslint \"{src,test}/**/*.{ts,js}\" --cache",
    
    "mail:authorize": "ts-node src/mail/authorizeAll.ts",
    "mail:validate": "ts-node src/mail/authorizeGmail.ts",
    "mail:auth-and-migrate": "node scripts/authenticate-and-migrate.js",
    "mail:auth-and-migrate:force": "node scripts/authenticate-and-migrate.js --force",
    "mail:auth-only": "node scripts/authenticate-and-migrate.js --no-migrate",
    "mail:poll": "node dist/src/mail/timedPollGmail.js",
    "mail:poll:single": "node dist/src/mail/pollGmail.js",
    "mail:poll:reset:aws": "node scripts/reset-aws-polling.js",
    "mail:poll:reset:local": "node scripts/reset-local-polling.js",
    "mail:poll:reset": "node scripts/reset-polling.js",
    "mail:poll:test": "node scripts/test-polling.js",
    
    "aws:deploy:infrastructure": "bash Cloud/AWS/scripts/deploy-infrastructure.sh",
    "aws:deploy:lambda": "bash Cloud/AWS/scripts/deploy-lambda.sh",
    "aws:deploy:secrets": "bash Cloud/AWS/scripts/populate-secrets-from-init.sh",
    "aws:deploy": "bash Cloud/AWS/scripts/deploy-complete.sh",
    "aws:build": "node scripts/aws-build.js",
    "aws:teardown": "bash Cloud/AWS/terraform-simple/teardown.sh",
    "aws:teardown:email-processing": "bash Cloud/AWS/terraform-email-processing/teardown.sh",
    "aws:populate-secrets": "node Cloud/AWS/scripts/populate-secrets.js",
    "aws:logs": "node Cloud/AWS/scripts/aws/get-lambda-logs.js",
    
    "test:all": "jest",
    "test:lambda": "jest test/lambdaIntegration.test.ts",
    "test:mail:send": "ts-node test/sendGmail.test.ts",
    "test:mail:send:clean": "ts-node test/sendGmail.test.ts --clean",
    
    "menu": "node scripts/menu.js",
    "menu:show-scripts": "node scripts/menu.js SCRIPTS",
    "help": "open docs/SYSTEM_SETUP_AND_TEARDOWN.md"
  }
}
```

### 2. Script Documentation Standards
```javascript
// Script documentation template
const scriptDocumentation = {
    "script-name": {
        description: "Brief description of what the script does",
        usage: "npm run script-name [options]",
        options: [
            "--option1: Description of option1",
            "--option2: Description of option2"
        ],
        examples: [
            "npm run script-name",
            "npm run script-name --option1 value1"
        ],
        dependencies: [
            "Required dependency 1",
            "Required dependency 2"
        ],
        prerequisites: [
            "Prerequisite 1",
            "Prerequisite 2"
        ],
        outputs: [
            "Output 1 description",
            "Output 2 description"
        ],
        errors: [
            "Error condition 1: Description and resolution",
            "Error condition 2: Description and resolution"
        ]
    }
};
```

## Script Implementation Standards

### 1. Script Execution Patterns
```javascript
// Standard script execution pattern
async function executeScript(scriptName, options = {}) {
    const startTime = Date.now();
    
    try {
        console.log(`🚀 Starting ${scriptName}`);
        console.log(`Options: ${JSON.stringify(options)}`);
        
        // Script logic here
        
        const duration = Date.now() - startTime;
        console.log(`✅ ${scriptName} completed successfully in ${duration}ms`);
        
        return { success: true, duration };
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ ${scriptName} failed after ${duration}ms:`, error);
        
        throw error;
    }
}
```

### 2. Error Handling Standards
```javascript
// Standard error handling pattern
function handleScriptError(error, scriptName) {
    console.error(`Error in ${scriptName}:`, error.message);
    
    if (error.code) {
        console.error(`Exit code: ${error.code}`);
    }
    
    if (error.stdout) {
        console.error('STDOUT:', error.stdout);
    }
    
    if (error.stderr) {
        console.error('STDERR:', error.stderr);
    }
    
    process.exit(1);
}
```

### 3. Logging Standards
```javascript
// Standard logging pattern
const logger = {
    info: (message) => console.log(`ℹ️  ${message}`),
    success: (message) => console.log(`✅ ${message}`),
    warning: (message) => console.log(`⚠️  ${message}`),
    error: (message) => console.log(`❌ ${message}`),
    debug: (message) => {
        if (process.env.DEBUG) {
            console.log(`🔍 ${message}`);
        }
    }
};
```

## Script Validation and Quality Assurance

### 1. Script Validation Standards
```javascript
// Script validation function
function validateScript(scriptName, scriptCommand) {
    const validations = [
        // Check if script exists
        () => {
            if (!scriptCommand) {
                throw new Error(`Script ${scriptName} is not defined`);
            }
        },
        
        // Check naming convention
        () => {
            const namingPattern = /^[a-z]+(:[a-z]+)*$/;
            if (!namingPattern.test(scriptName)) {
                throw new Error(`Script name ${scriptName} does not follow naming convention`);
            }
        },
        
        // Check command validity
        () => {
            if (typeof scriptCommand !== 'string') {
                throw new Error(`Script command for ${scriptName} must be a string`);
            }
        }
    ];
    
    validations.forEach(validation => validation());
}
```

### 2. Script Testing Standards
```javascript
// Script testing pattern
describe('Package.json Scripts', () => {
    it('should have valid script names', () => {
        const packageJson = require('../package.json');
        
        Object.keys(packageJson.scripts).forEach(scriptName => {
            expect(scriptName).toMatch(/^[a-z]+(:[a-z]+)*$/);
        });
    });
    
    it('should have valid script commands', () => {
        const packageJson = require('../package.json');
        
        Object.entries(packageJson.scripts).forEach(([name, command]) => {
            expect(typeof command).toBe('string');
            expect(command.length).toBeGreaterThan(0);
        });
    });
});
```

## Script Management and Maintenance

### 1. Script Addition Process
```javascript
// Script addition checklist
const scriptAdditionChecklist = {
    naming: [
        "Follow naming convention (category:subcategory:operation)",
        "Use lowercase letters and colons only",
        "Be descriptive and clear"
    ],
    
    implementation: [
        "Implement proper error handling",
        "Add comprehensive logging",
        "Include progress indicators",
        "Handle edge cases"
    ],
    
    documentation: [
        "Add script description",
        "Document options and parameters",
        "Provide usage examples",
        "List dependencies and prerequisites"
    ],
    
    testing: [
        "Add unit tests",
        "Test error conditions",
        "Test edge cases",
        "Validate outputs"
    ],
    
    integration: [
        "Update menu system",
        "Update documentation",
        "Test integration with other scripts",
        "Validate in different environments"
    ]
};
```

### 2. Script Maintenance Standards
```javascript
// Script maintenance schedule
const scriptMaintenanceSchedule = {
    weekly: [
        "Review script performance",
        "Check for deprecated dependencies",
        "Update documentation",
        "Run test suite"
    ],
    
    monthly: [
        "Review script usage patterns",
        "Optimize slow scripts",
        "Update dependencies",
        "Security audit"
    ],
    
    quarterly: [
        "Comprehensive script review",
        "Performance optimization",
        "Architecture review",
        "User feedback analysis"
    ]
};
```

## Script Integration with Menu System

### 1. Menu Integration Standards
```javascript
// Menu integration pattern
const menuIntegration = {
    // Add script to menu structure
    addToMenu: (scriptName, menuItem) => {
        const menuStructure = require('./menu-structure');
        
        // Find appropriate category
        const category = findCategory(scriptName);
        
        // Add menu item
        category.items.push({
            id: scriptName,
            name: menuItem.name,
            description: menuItem.description,
            command: scriptName,
            type: 'script'
        });
    },
    
    // Validate menu integration
    validateIntegration: (scriptName) => {
        const menuStructure = require('./menu-structure');
        
        // Check if script is in menu
        const menuItem = findMenuItem(scriptName, menuStructure);
        
        if (!menuItem) {
            throw new Error(`Script ${scriptName} is not integrated with menu system`);
        }
    }
};
```

### 2. Menu-Script Synchronization
```javascript
// Menu-script synchronization
function synchronizeMenuAndScripts() {
    const packageJson = require('./package.json');
    const menuStructure = require('./menu-structure');
    
    // Get all scripts
    const scripts = Object.keys(packageJson.scripts);
    
    // Get all menu items
    const menuItems = getAllMenuItems(menuStructure);
    
    // Check for orphaned scripts
    const orphanedScripts = scripts.filter(script => 
        !menuItems.find(item => item.command === script)
    );
    
    // Check for missing scripts
    const missingScripts = menuItems.filter(item => 
        item.type === 'script' && !scripts.includes(item.command)
    );
    
    return { orphanedScripts, missingScripts };
}
```

## Script Performance and Optimization

### 1. Performance Monitoring
```javascript
// Script performance monitoring
const performanceMonitor = {
    start: (scriptName) => {
        const startTime = process.hrtime.bigint();
        return { scriptName, startTime };
    },
    
    end: (monitor) => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - monitor.startTime) / 1000000; // Convert to milliseconds
        
        console.log(`⏱️  ${monitor.scriptName} took ${duration.toFixed(2)}ms`);
        
        return duration;
    }
};
```

### 2. Script Optimization Standards
```javascript
// Script optimization guidelines
const optimizationGuidelines = {
    performance: [
        "Use async/await for I/O operations",
        "Implement proper caching",
        "Minimize file system operations",
        "Use streaming for large files",
        "Implement parallel processing where possible"
    ],
    
    memory: [
        "Avoid memory leaks",
        "Use proper garbage collection",
        "Limit memory usage for large operations",
        "Implement proper cleanup"
    ],
    
    network: [
        "Implement retry logic",
        "Use connection pooling",
        "Implement proper timeout handling",
        "Minimize network requests"
    ]
};
```

## Script Security and Compliance

### 1. Security Standards
```javascript
// Script security standards
const securityStandards = {
    inputValidation: [
        "Validate all user inputs",
        "Sanitize file paths",
        "Validate command line arguments",
        "Check file permissions"
    ],
    
    errorHandling: [
        "Don't expose sensitive information in errors",
        "Log errors securely",
        "Implement proper error recovery",
        "Handle edge cases"
    ],
    
    dependencies: [
        "Use only trusted dependencies",
        "Regular security audits",
        "Keep dependencies updated",
        "Monitor for vulnerabilities"
    ]
};
```

### 2. Compliance Standards
```javascript
// Script compliance standards
const complianceStandards = {
    documentation: [
        "Document all scripts",
        "Maintain up-to-date documentation",
        "Include usage examples",
        "Document error conditions"
    ],
    
    testing: [
        "Comprehensive test coverage",
        "Test error conditions",
        "Test edge cases",
        "Regular test execution"
    ],
    
    monitoring: [
        "Monitor script execution",
        "Track performance metrics",
        "Monitor error rates",
        "Track usage patterns"
    ]
};
```

This comprehensive approach ensures consistent, maintainable, and well-documented package.json scripts that provide a reliable interface for all system operations. 