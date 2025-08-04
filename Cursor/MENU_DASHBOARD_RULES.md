# Menu Dashboard Rules for Chatterbox

## Overview
This project uses a centralized menu-driven dashboard system (`scripts/menu.js`) as the primary interface for all system operations. The menu system provides hierarchical organization, clear navigation, and comprehensive access to all project functionality.

## Menu System Philosophy (1.a.24)

### 1. Centralized Dashboard Approach
- **Single Point of Entry**: All system operations accessible through one menu interface
- **Hierarchical Organization**: Logical grouping of related operations
- **Consistent Navigation**: Standardized navigation patterns throughout
- **Comprehensive Coverage**: Every system operation must be menu-accessible
- **User-Friendly Interface**: Clear, intuitive, and easy to use

### 2. Menu-Driven Architecture
- **No Direct Script Execution**: Users should not need to run scripts directly
- **Guided Operations**: Menu provides guidance and context for operations
- **Error Prevention**: Menu validates inputs and prevents common errors
- **Consistent Experience**: Same interface for all users and operations
- **Extensible Design**: Easy to add new operations and categories

## Menu Structure and Organization

### 1. Hierarchical Menu Structure
```javascript
const MENU_STRUCTURE = {
    'build-teardown': {
        name: 'Build / Teardown',
        description: 'AWS infrastructure build and teardown operations',
        items: [
            {
                id: 'aws-build',
                name: 'AWS Build (6 items)',
                description: 'Build and deploy AWS infrastructure',
                type: 'category',
                submenu: [
                    {
                        id: 'deploy-complete',
                        name: 'Deploy Complete System',
                        description: 'Deploy all AWS infrastructure and setup SES',
                        command: 'aws:deploy',
                        type: 'script'
                    }
                ]
            }
        ]
    }
};
```

### 2. Menu Categories
- **Build / Teardown**: Infrastructure deployment and cleanup
- **Operations**: Day-to-day operational tasks
- **Monitoring**: System monitoring and logging
- **Testing**: Testing and validation operations
- **Maintenance**: System maintenance and management
- **Configuration**: Configuration and setup operations
- **Standalone Actions**: Independent operations and utilities

### 3. Menu Item Types
- **Category**: Container for related menu items
- **Script**: Executes a specific npm script or command
- **Function**: Executes a JavaScript function
- **Submenu**: Contains additional menu items
- **External**: Opens external resources or tools

## Menu Item Standards

### 1. Menu Item Structure
```javascript
{
    id: 'unique-identifier',           // Unique identifier for the item
    name: 'Display Name',              // Human-readable display name
    description: 'Detailed description', // Clear description of the operation
    command: 'npm:script:name',        // Command to execute
    type: 'script',                    // Type of menu item
    submenu: [],                       // Submenu items (if applicable)
    requiresConfirmation: false,       // Whether confirmation is required
    dangerous: false,                  // Whether operation is potentially dangerous
    prerequisites: []                  // Prerequisites that must be met
}
```

### 2. Naming Conventions
- **Descriptive Names**: Use clear, descriptive names for menu items
- **Consistent Formatting**: Use consistent capitalization and formatting
- **Action-Oriented**: Use action verbs for operation names
- **Category Prefixes**: Use category prefixes for related items
- **Item Counts**: Include item counts for categories (e.g., "AWS Build (6 items)")

### 3. Description Standards
- **Clear Purpose**: Explain what the operation does
- **Expected Outcome**: Describe what to expect
- **Requirements**: Mention any prerequisites or requirements
- **Script Information**: Include underlying script information when relevant
- **Warning Information**: Include warnings for dangerous operations

## Menu Navigation and Interaction

### 1. Navigation Patterns
```javascript
// Main menu navigation
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
```

### 2. Input Handling
- **Arrow Keys**: Navigate between menu items
- **Enter Key**: Select/execute menu item
- **Escape Key**: Go back to previous menu
- **Number Keys**: Direct selection (if enabled)
- **Search Functionality**: Text search for menu items

### 3. Visual Feedback
- **Selection Indicators**: Clear visual indication of selected item
- **Description Display**: Show description for selected item
- **Progress Indicators**: Show progress for long-running operations
- **Status Updates**: Provide status updates during operations
- **Error Display**: Clear error messages and recovery options

## Menu Extensibility and Maintenance

### 1. Adding New Menu Items
```javascript
// Example: Adding a new menu item
const newMenuItem = {
    id: 'new-operation',
    name: 'New Operation',
    description: 'Description of the new operation',
    command: 'npm:run:new-operation',
    type: 'script',
    requiresConfirmation: false,
    dangerous: false
};

// Add to appropriate category
MENU_STRUCTURE['operations'].items.push(newMenuItem);
```

### 2. Menu Configuration
- **External Configuration**: Store menu structure in external configuration files
- **Dynamic Loading**: Load menu items dynamically based on system state
- **Conditional Items**: Show/hide items based on system conditions
- **User Permissions**: Control access based on user permissions
- **Environment-Specific**: Show different items for different environments

### 3. Menu Validation
- **Command Validation**: Validate that commands exist before adding to menu
- **Prerequisite Checking**: Check prerequisites before allowing execution
- **Permission Validation**: Validate user permissions for operations
- **Environment Validation**: Validate environment requirements
- **Dependency Checking**: Check dependencies before execution

## Menu Integration with Scripts

### 1. Script Execution
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

### 2. NPM Script Integration
- **Standard Naming**: Use consistent naming for npm scripts
- **Error Handling**: Proper error handling and display
- **Progress Tracking**: Show progress for long-running scripts
- **Output Capture**: Capture and display script output
- **Return Values**: Handle script return values appropriately

### 3. Function Integration
- **JavaScript Functions**: Execute JavaScript functions directly
- **Async Support**: Support for async/await operations
- **Error Handling**: Proper error handling for function execution
- **Result Display**: Display function results appropriately
- **State Management**: Manage state during function execution

## Menu Security and Safety

### 1. Dangerous Operations
- **Confirmation Required**: Require confirmation for dangerous operations
- **Clear Warnings**: Provide clear warnings about potential consequences
- **Dry Run Options**: Provide dry-run options where possible
- **Rollback Information**: Provide rollback information
- **Audit Logging**: Log all dangerous operations

### 2. Permission Control
- **User Permissions**: Control access based on user permissions
- **Environment Restrictions**: Restrict operations based on environment
- **Role-Based Access**: Implement role-based access control
- **Audit Trail**: Maintain audit trail of all operations
- **Session Management**: Manage user sessions appropriately

### 3. Error Prevention
- **Input Validation**: Validate all user inputs
- **Prerequisite Checking**: Check prerequisites before execution
- **Environment Validation**: Validate environment before operations
- **Dependency Checking**: Check dependencies before execution
- **State Validation**: Validate system state before operations

## Menu Documentation and Help

### 1. Built-in Help
- **Help Commands**: Provide help commands for menu items
- **Usage Examples**: Include usage examples
- **Parameter Documentation**: Document parameters and options
- **Troubleshooting**: Provide troubleshooting information
- **FAQ Section**: Include frequently asked questions

### 2. Context-Sensitive Help
- **Item-Specific Help**: Provide help specific to selected item
- **Category Help**: Provide help for entire categories
- **Operation Help**: Provide help for specific operations
- **Error Help**: Provide help for error conditions
- **Recovery Help**: Provide help for recovery procedures

### 3. External Documentation
- **Documentation Links**: Link to external documentation
- **Tutorial Integration**: Integrate with tutorials and guides
- **Video Integration**: Link to video tutorials
- **Community Resources**: Link to community resources
- **Support Information**: Provide support contact information

## Menu Performance and Optimization

### 1. Performance Considerations
- **Fast Loading**: Ensure menu loads quickly
- **Efficient Navigation**: Optimize navigation performance
- **Minimal Memory Usage**: Minimize memory usage
- **Responsive Interface**: Ensure responsive user interface
- **Background Operations**: Handle background operations efficiently

### 2. Caching and Optimization
- **Menu Caching**: Cache menu structure for performance
- **Command Caching**: Cache command availability
- **Result Caching**: Cache operation results where appropriate
- **State Caching**: Cache system state information
- **Configuration Caching**: Cache configuration information

### 3. Monitoring and Metrics
- **Usage Tracking**: Track menu usage patterns
- **Performance Metrics**: Monitor menu performance
- **Error Tracking**: Track menu errors and issues
- **User Feedback**: Collect user feedback on menu usability
- **Improvement Tracking**: Track menu improvements over time

## Menu Testing and Quality Assurance

### 1. Menu Testing
- **Functionality Testing**: Test all menu functionality
- **Navigation Testing**: Test menu navigation
- **Integration Testing**: Test integration with scripts and functions
- **Error Testing**: Test error handling and recovery
- **Performance Testing**: Test menu performance

### 2. User Experience Testing
- **Usability Testing**: Test menu usability
- **Accessibility Testing**: Test menu accessibility
- **Cross-Platform Testing**: Test on different platforms
- **Terminal Testing**: Test in different terminal environments
- **User Acceptance Testing**: Conduct user acceptance testing

### 3. Quality Standards
- **Code Quality**: Maintain high code quality standards
- **Documentation Quality**: Maintain high documentation quality
- **Testing Coverage**: Maintain high testing coverage
- **Performance Standards**: Meet performance standards
- **Security Standards**: Meet security standards

This comprehensive approach ensures that the menu system provides a professional, user-friendly, and comprehensive interface for all system operations. 