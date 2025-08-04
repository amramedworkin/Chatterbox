# Console Output and Display Rules for Chatterbox

## Overview
This project follows comprehensive console output and display standards for consistent user experience, clear information sharing, and professional presentation of system state and status.

## Console Output Philosophy (1.a.23)

### 1. Centralized Display Standards
- **Consistent Information Display**: All console output must follow established patterns
- **State and Status Visibility**: Clearly show system state, progress, and status
- **Process Execution Tracking**: Display detailed information about executing processes
- **Error and Success Communication**: Provide clear feedback for all operations
- **User-Friendly Presentation**: Make information easily readable and understandable

### 2. Information Hierarchy
- **Critical Information**: Use prominent display for critical system information
- **Progress Indicators**: Show clear progress for long-running operations
- **Status Updates**: Provide regular status updates during operations
- **Error Reporting**: Display errors clearly with actionable information
- **Success Confirmation**: Confirm successful operations with clear feedback

### 3. Process Documentation
- **Step-by-Step Display**: Show each step of process execution
- **Timing Information**: Include timing information for operations
- **Resource Usage**: Display resource usage when relevant
- **Dependency Tracking**: Show dependencies and prerequisites
- **Completion Status**: Clearly indicate when processes complete

## Color Schemes and Display Standards (1.a.23.i, 1.a.23.ii)

### 1. Black Background Color Scheme (1.a.23.iii)
**Primary Colors for Dark Terminal:**
```javascript
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',           // Errors, failures, critical issues
    green: '\x1b[32m',         // Success, completion, positive status
    yellow: '\x1b[33m',        // Warnings, important notices, scripts
    blue: '\x1b[34m',          // Information, general messages
    magenta: '\x1b[35m',       // User input, selections, interactive elements
    cyan: '\x1b[36m',          // Headers, titles, section dividers
    white: '\x1b[37m',         // Default text, normal content
    bgBlue: '\x1b[44m',        // Background for headers
    bgGreen: '\x1b[42m',       // Background for success indicators
};
```

**Color Usage Rules:**
- **Red**: Errors, failures, critical issues, stop conditions
- **Green**: Success, completion, positive status, go conditions
- **Yellow**: Warnings, important notices, script commands, attention required
- **Blue**: Information messages, general status, neutral information
- **Magenta**: User input, menu selections, interactive elements
- **Cyan**: Headers, titles, section dividers, process boundaries
- **White**: Default text, normal content, standard output
- **Bright**: Emphasis, important information, highlights

### 2. White Background Color Scheme (1.a.23.iv)
**Alternative Colors for Light Terminal:**
```javascript
const lightColors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',           // Errors, failures (same as dark)
    green: '\x1b[32m',         // Success, completion (same as dark)
    yellow: '\x1b[33m',        // Warnings, notices (same as dark)
    blue: '\x1b[34m',          // Information (same as dark)
    magenta: '\x1b[35m',       // User input (same as dark)
    cyan: '\x1b[36m',          // Headers (same as dark)
    white: '\x1b[37m',         // Default text (same as dark)
    bgBlue: '\x1b[44m',        // Background for headers
    bgGreen: '\x1b[42m',       // Background for success
    // Additional colors for better contrast on light backgrounds
    gray: '\x1b[90m',          // Secondary information, less important
    darkGray: '\x1b[30m',      // Alternative text color
};
```

**Light Background Color Usage:**
- **Red**: Errors, failures (maintained for consistency)
- **Green**: Success, completion (maintained for consistency)
- **Yellow**: Warnings, notices (maintained for consistency)
- **Blue**: Information (maintained for consistency)
- **Magenta**: User input (maintained for consistency)
- **Cyan**: Headers (maintained for consistency)
- **Gray**: Secondary information, less important details
- **Dark Gray**: Alternative text color for better contrast

## Display Functions and Standards

### 1. Standard Display Functions
```javascript
// Information messages
function printInfo(message) {
    console.log(chalk.blue(`ℹ️  ${message}`));
}

// Success messages
function printSuccess(message) {
    console.log(chalk.green(`✅ ${message}`));
}

// Warning messages
function printWarning(message) {
    console.log(chalk.yellow(`⚠️  ${message}`));
}

// Error messages
function printError(message) {
    console.log(chalk.red(`❌ ${message}`));
}

// Header messages
function printHeader(message) {
    console.log(chalk.cyan('='.repeat(80)));
    console.log(chalk.cyan.bold(`🚀 ${message}`));
    console.log(chalk.cyan('='.repeat(80)));
}

// Section dividers
function printSection(title) {
    console.log(chalk.cyan('\n' + '='.repeat(60)));
    console.log(chalk.cyan.bold(`📋 ${title}`));
    console.log(chalk.cyan('='.repeat(60)));
}

// Process steps
function printStep(stepNumber, description) {
    console.log(chalk.magenta(`\n${stepNumber}. ${description}`));
}

// Status updates
function printStatus(status, details) {
    console.log(chalk.blue(`📊 ${status}: ${details}`));
}
```

### 2. Emoji Usage Standards
- **ℹ️**: Information, general messages
- **✅**: Success, completion, positive results
- **⚠️**: Warnings, important notices
- **❌**: Errors, failures, problems
- **🚀**: Headers, main sections, launches
- **📋**: Sections, subsections
- **📊**: Status, metrics, statistics
- **🔍**: Searching, looking up, investigation
- **📧**: Email-related operations
- **🔐**: Authentication, security operations
- **🧪**: Testing, experiments
- **📤**: Sending, outgoing operations
- **📥**: Receiving, incoming operations

## Menu System Display Standards

### 1. Menu Structure Display
```javascript
// Main menu display
function printMainMenu(selectedIndex) {
    clearScreen();
    printHeader('Chatterbox System Menu');
    
    Object.entries(MENU_STRUCTURE).forEach(([key, category], index) => {
        const isSelected = index === selectedIndex;
        const prefix = isSelected ? chalk.bgBlue.white(' > ') : '   ';
        const color = isSelected ? chalk.cyan.bold : chalk.white;
        
        console.log(`${prefix}${color(category.name)}`);
        if (isSelected) {
            console.log(chalk.gray(`    ${category.description}`));
        }
    });
}

// Submenu display
function printSubMenu(category, selectedIndex) {
    clearScreen();
    printHeader(`${category.name} - ${category.description}`);
    
    category.items.forEach((item, index) => {
        const isSelected = index === selectedIndex;
        const prefix = isSelected ? chalk.bgBlue.white(' > ') : '   ';
        const color = isSelected ? chalk.cyan.bold : chalk.white;
        
        console.log(`${prefix}${color(item.name)}`);
        if (isSelected) {
            console.log(chalk.gray(`    ${item.description}`));
        }
    });
}
```

### 2. Interactive Elements
- **Selection Indicators**: Use `>` prefix for selected items
- **Color Coding**: Use cyan for selected items, white for others
- **Descriptions**: Show descriptions for selected items in gray
- **Navigation**: Clear navigation instructions
- **Help Text**: Provide help text for complex operations

## Process Execution Display

### 1. Command Execution Display
```javascript
async function executeCommand(command, description) {
    printHeader(`Executing: ${description}`);
    console.log(chalk.yellow('='.repeat(80)));
    console.log(chalk.yellow.bold(`ℹ Running command: npm run ${command}`));
    console.log(chalk.yellow('='.repeat(80)));
    
    try {
        const result = await runNpmScript(command);
        printSuccess(`✅ Command completed successfully`);
        return result;
    } catch (error) {
        printError(`❌ Command failed with exit code ${error.code}`);
        console.log(chalk.red(error.message));
        throw error;
    }
}
```

### 2. Progress Tracking
```javascript
// Progress bar for long operations
function showProgress(current, total, operation) {
    const percentage = Math.round((current / total) * 100);
    const barLength = 30;
    const filledLength = Math.round((barLength * current) / total);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    
    console.log(chalk.blue(`\r📊 ${operation}: [${bar}] ${percentage}% (${current}/${total})`));
}

// Step-by-step progress
function showStepProgress(step, totalSteps, description) {
    console.log(chalk.magenta(`\n${step}/${totalSteps}. ${description}`));
}
```

## Error and Status Display

### 1. Error Display Standards
```javascript
function displayError(error, context) {
    printError(`Error in ${context}`);
    console.log(chalk.red('Details:'));
    console.log(chalk.red(`  Message: ${error.message}`));
    if (error.code) {
        console.log(chalk.red(`  Code: ${error.code}`));
    }
    if (error.stack) {
        console.log(chalk.red('  Stack:'));
        console.log(chalk.gray(error.stack));
    }
}
```

### 2. Status Display Standards
```javascript
function displayStatus(status) {
    const statusColors = {
        'running': chalk.blue,
        'completed': chalk.green,
        'failed': chalk.red,
        'pending': chalk.yellow,
        'stopped': chalk.gray
    };
    
    const color = statusColors[status] || chalk.white;
    console.log(color(`Status: ${status}`));
}
```

## Configuration and Environment Detection

### 1. Background Detection
```javascript
function detectBackground() {
    // Detect if terminal supports color
    const supportsColor = process.stdout.isTTY && process.env.TERM !== 'dumb';
    
    // Default to dark background, can be overridden
    const background = process.env.TERM_BACKGROUND || 'dark';
    
    return {
        supportsColor,
        background,
        colors: background === 'light' ? lightColors : colors
    };
}
```

### 2. Display Configuration
```javascript
const displayConfig = {
    // Enable/disable colors
    useColors: true,
    
    // Enable/disable emojis
    useEmojis: true,
    
    // Enable/disable progress bars
    showProgress: true,
    
    // Enable/disable detailed output
    verbose: false,
    
    // Maximum line length for wrapping
    maxLineLength: 80,
    
    // Indentation for nested information
    indentSize: 2
};
```

## Implementation Guidelines

### 1. Consistent Usage
- **Always use display functions**: Use `printInfo`, `printSuccess`, etc.
- **Consistent color coding**: Follow established color meanings
- **Proper emoji usage**: Use appropriate emojis for context
- **Clear formatting**: Use proper spacing and indentation
- **Error handling**: Always display errors clearly

### 2. Performance Considerations
- **Minimize output**: Don't overwhelm users with too much information
- **Progress indicators**: Show progress for long operations
- **Batch operations**: Group related output together
- **Clear completion**: Always indicate when operations complete

### 3. Accessibility
- **Color alternatives**: Provide alternatives for color-blind users
- **Clear text**: Use clear, readable text
- **Structured output**: Use consistent structure for information
- **Error clarity**: Make errors easy to understand and act upon

## Integration with Existing Systems

### 1. Menu System Integration
- **Consistent display**: Use same display standards across all menus
- **Clear navigation**: Make navigation intuitive
- **Status feedback**: Provide clear feedback for all actions
- **Error handling**: Handle errors gracefully with clear messages

### 2. Script Integration
- **Standard functions**: Use standard display functions in all scripts
- **Progress tracking**: Show progress for long-running scripts
- **Error reporting**: Report errors clearly with context
- **Success confirmation**: Confirm successful script execution

### 3. Logging Integration
- **Console logging**: Integrate with existing logging systems
- **File logging**: Maintain file logs for debugging
- **Error logging**: Log errors for troubleshooting
- **Performance logging**: Log performance metrics when relevant

This comprehensive approach ensures consistent, professional, and user-friendly console output across all system operations. 