# Cursor Rules Guide for Chatterbox Project

## Overview

This guide provides comprehensive information about the Cursor rules system implemented for the Chatterbox project. The rules system ensures consistent development practices, comprehensive automation, and adherence to established patterns and procedures.

## What are Cursor Rules?

### Definition
Cursor rules are configuration files that guide the AI assistant (Cursor) in understanding project-specific patterns, conventions, and requirements. They help ensure that all code generation, suggestions, and assistance align with the project's established standards.

### Purpose
- **Consistency**: Ensure consistent development practices across the project
- **Quality**: Maintain high code quality and adherence to standards
- **Automation**: Promote automation-first development approach
- **Documentation**: Ensure comprehensive documentation practices
- **Compliance**: Maintain compliance with security and operational requirements

### Benefits
- **Faster Development**: AI assistance that understands project patterns
- **Reduced Errors**: Consistent application of established practices
- **Better Code Quality**: Automated adherence to quality standards
- **Improved Documentation**: Consistent documentation practices
- **Enhanced Security**: Built-in security best practices

## Cursor Rules Overview

### Main Rules File
The primary rules file is `.cursorrules` in the project root, which provides:
- High-level development principles
- References to specific rule categories
- Core workflow guidelines
- Compliance requirements

### Specialized Rule Files
Individual rule files are organized in the `Cursor/` directory:

| File | Purpose | Focus Area |
|------|---------|------------|
| `PROJECT_MANAGEMENT_RULES.md` | Overall project management and governance | Project structure, processes, and management |
| `LOCAL_DEVELOPMENT_RULES.md` | Local development practices and standards | Local setup, development workflow, code quality |
| `AWS_CLOUD_RULES.md` | AWS cloud development and infrastructure | AWS services, Terraform, serverless architecture |
| `AZURE_CLOUD_RULES.md` | Azure cloud development and infrastructure | Azure services, ACP, serverless architecture |
| `AI_INTEGRATION_RULES.md` | AI service integration patterns | OpenAI, AWS Bedrock, Azure AI services |
| `SCRIPTING_AUTOMATION_RULES.md` | Automation and scripting standards | Script development, automation patterns |
| `TESTING_QUALITY_RULES.md` | Testing and quality assurance | Testing strategies, quality standards |
| `DOCUMENTATION_STANDARDS_RULES.md` | Documentation practices and standards | Documentation formats, naming conventions |
| `INITIALIZATION_RULES.md` | System initialization and setup | Local vs AWS standup, data/init folder concept |
| `CONFIGURATION_MANAGEMENT_RULES.md` | Configuration management and versioning | Configuration backup, rollback, modification procedures |

## Setting Up Cursor Rules

### Prerequisites
- Cursor IDE installed and configured
- Node.js and npm available
- Git repository access
- Project root directory access

### Automated Setup (Recommended)

#### Step 1: Run the Setup Script
```bash
# Navigate to project root
cd /path/to/chatterbox

# Run the setup script
node scripts/setup-cursor-rules.js
```

#### Step 2: Verify Setup
The script will:
- Create backup of existing rules (if any)
- Generate timestamped backup directory
- Create all rule files
- Copy rules to init directory
- Generate setup logs

#### Step 3: Restart Cursor
After running the setup script:
1. Close Cursor completely
2. Reopen Cursor
3. Open the Chatterbox project
4. Start a new conversation to test the rules

### Manual Setup (Alternative)

#### Step 1: Create Rules Directory
```bash
mkdir -p Cursor
```

#### Step 2: Create Main Rules File
Create `.cursorrules` in the project root with the content from the automated setup.

#### Step 3: Create Individual Rule Files
Create each rule file in the `Cursor/` directory with the appropriate content.

#### Step 4: Restart Cursor
Follow the same restart procedure as automated setup.

## Platform-Specific Setup

### macOS Setup
```bash
# Using Homebrew (if not already installed)
brew install node

# Navigate to project
cd /Users/username/Projects/Chatterbox

# Run setup
node scripts/setup-cursor-rules.js
```

### Windows Setup
```powershell
# Using PowerShell
# Navigate to project
cd C:\Users\username\Projects\Chatterbox

# Run setup
node scripts\setup-cursor-rules.js
```

### Linux Setup
```bash
# Navigate to project
cd /home/username/Projects/Chatterbox

# Run setup
node scripts/setup-cursor-rules.js
```

## Using Cursor Rules

### Basic Usage
1. **Start a Conversation**: Begin a new conversation in Cursor
2. **Reference Rules**: The AI will automatically reference the established rules
3. **Follow Patterns**: Generated code will follow project patterns
4. **Ask for Guidance**: Ask specific questions about project practices

### Example Interactions

#### Code Generation
```
User: "Create a new Lambda function for email processing"
AI: [Generates code following AWS_CLOUD_RULES.md patterns]
```

#### Configuration Management
```
User: "How should I configure the new feature?"
AI: [References LOCAL_DEVELOPMENT_RULES.md for config patterns]
```

#### Testing Implementation
```
User: "What tests should I write for this component?"
AI: [References TESTING_QUALITY_RULES.md for testing strategies]
```

### Rule-Specific Queries

#### Project Management
- "What's the proper way to add a new feature?"
- "How should I document this change?"
- "What's the deployment process for this component?"

#### Local Development
- "How should I set up the local environment?"
- "What's the proper way to handle configuration?"
- "How should I structure this new component?"

#### Cloud Development
- "What's the best way to implement this in AWS?"
- "How should I structure the Terraform configuration?"
- "What's the proper way to handle secrets?"

#### AI Integration
- "How should I integrate with OpenAI?"
- "What's the best way to use AWS Bedrock?"
- "How should I configure AI services?"

## Extending and Modifying Rules

### Adding New Rules
1. **Create Rule File**: Add new rule file to `Cursor/` directory
2. **Update Main Rules**: Reference new rule in `.cursorrules`
3. **Document Changes**: Update this guide with new rule information
4. **Test Rules**: Verify rules work as expected

### Modifying Existing Rules
1. **Backup Current Rules**: Use the setup script to create backup
2. **Edit Rule Files**: Modify the appropriate rule file
3. **Test Changes**: Verify modifications work as expected
4. **Update Documentation**: Update relevant documentation

### Deleting Rules
1. **Remove Rule File**: Delete the rule file from `Cursor/` directory
2. **Update Main Rules**: Remove reference from `.cursorrules`
3. **Update Documentation**: Remove references from this guide
4. **Test System**: Verify system works without the rule

## Rule Categories and Usage

### Project Management Rules
**File**: `Cursor/rules/PROJECT_MANAGEMENT_RULES.md`

**Use When**:
- Planning new features or components
- Setting up project structure
- Establishing development processes
- Managing project governance

**Key Areas**:
- Local setup procedures
- Cloud infrastructure patterns
- AI integration strategies
- Scripting and automation
- Testing and quality assurance
- Documentation standards

### Local Development Rules
**File**: `Cursor/rules/LOCAL_DEVELOPMENT_RULES.md`

**Use When**:
- Setting up local development environment
- Writing new code or components
- Managing configuration
- Implementing local testing

**Key Areas**:
- Configuration management
- Development workflow
- Code quality standards
- Testing procedures
- Debugging and troubleshooting

### AWS Cloud Rules
**File**: `Cursor/rules/AWS_CLOUD_RULES.md`

**Use When**:
- Developing AWS-based features
- Setting up AWS infrastructure
- Implementing serverless components
- Managing AWS resources

**Key Areas**:
- Serverless architecture
- Terraform implementation
- Lambda function development
- AWS service integration
- Security and compliance

### Azure Cloud Rules
**File**: `Cursor/rules/AZURE_CLOUD_RULES.md`

**Use When**:
- Developing Azure-based features
- Setting up Azure infrastructure
- Implementing Azure Functions
- Managing Azure resources

**Key Areas**:
- Azure Configuration Provider (ACP)
- Azure Functions development
- Azure service integration
- Bicep/ARM templates
- Security and compliance

### AI Integration Rules
**File**: `Cursor/rules/AI_INTEGRATION_RULES.md`

**Use When**:
- Integrating AI services
- Implementing OpenAI features
- Using AWS Bedrock
- Implementing Azure AI services

**Key Areas**:
- OpenAI API integration
- AWS Bedrock usage
- Azure AI services
- Configuration management
- Error handling and resilience

### Scripting and Automation Rules
**File**: `Cursor/rules/SCRIPTING_AUTOMATION_RULES.md`

**Use When**:
- Creating automation scripts
- Implementing deployment procedures
- Setting up CI/CD pipelines
- Managing operational procedures

**Key Areas**:
- Script organization
- Menu system implementation
- Error handling and recovery
- Testing and validation

### Initialization Rules
**File**: `Cursor/rules/INITIALIZATION_RULES.md`

**Use When**:
- Setting up new environments
- Initializing system components
- Managing configuration deployment
- Implementing rollback procedures

**Key Areas**:
- Local vs AWS standup procedures
- Data/init folder concept and management
- Configuration validation and testing
- Environment-agnostic initialization
- Backup and recovery procedures

### Configuration Management Rules
**File**: `Cursor/rules/CONFIGURATION_MANAGEMENT_RULES.md`

**Use When**:
- Making configuration changes
- Implementing configuration versioning
- Setting up backup and rollback procedures
- Managing configuration approval processes

**Key Areas**:
- Configuration versioning and history
- Safe configuration modification procedures
- Backup and rollback capabilities
- Configuration change approval process
- Configuration monitoring and alerting
- Monitoring and logging

### Testing and Quality Rules
**File**: `Cursor/rules/TESTING_QUALITY_RULES.md`

**Use When**:
- Writing tests for components
- Implementing quality assurance
- Setting up testing frameworks
- Managing test data

**Key Areas**:
- Unit testing
- Integration testing
- End-to-end testing
- Performance testing
- Security testing

### Documentation Standards Rules
**File**: `Cursor/rules/DOCUMENTATION_STANDARDS_RULES.md`

**Use When**:
- Writing documentation
- Creating API documentation
- Documenting processes
- Managing documentation

**Key Areas**:
- Naming conventions
- Documentation structure
- Content guidelines
- Documentation maintenance
- Quality standards

## Expected Impact on Development Process (5.f)

This section details the actual impact these cursor rules will have on the design, development, and coding process, providing concrete examples of when and how the rules will influence development decisions and practices.

### Actual Impact of Rules on Development (5.f.1)

The cursor rules system will have specific, measurable impacts on the development process that go beyond abstract rule-following. These impacts will manifest in concrete ways during daily development activities.

#### Code Generation and Suggestions
**Impact**: AI will generate code that follows established project patterns
**Examples**:
- When creating new Lambda functions, AI will automatically use the serverless-first approach with proper error handling and CloudWatch logging
- When adding new npm scripts, AI will follow the category:subcategory:operation naming convention
- When implementing authentication, AI will use the configuration-first approach with proper credential management

#### Architecture Decisions
**Impact**: AI will guide architectural choices toward established patterns
**Examples**:
- When suggesting database solutions, AI will prioritize DynamoDB over RDS for serverless compatibility
- When recommending compute solutions, AI will suggest Lambda functions over EC2 instances
- When proposing monitoring solutions, AI will default to CloudWatch with structured JSON logging

#### Configuration Management
**Impact**: AI will enforce configuration-first development practices
**Examples**:
- When adding new settings, AI will place them in `config.json` rather than environment variables
- When implementing feature flags, AI will use the configuration management system with versioning
- When setting up new services, AI will create proper backup and rollback procedures

#### Testing and Quality Assurance
**Impact**: AI will implement comprehensive testing strategies
**Examples**:
- When creating new features, AI will automatically suggest appropriate test types (unit, integration, E2E)
- When implementing complex logic, AI will include performance testing considerations
- When adding new APIs, AI will create both automated and manual testing procedures

#### Documentation and Process
**Impact**: AI will maintain comprehensive documentation standards
**Examples**:
- When creating new features, AI will automatically generate documentation following established conventions
- When implementing processes, AI will document them in the appropriate location with proper formatting
- When making architectural decisions, AI will record the rationale in the documentation

### Specific Development Process Examples (5.f.2)

#### Example 1: Adding a New Email Processing Feature
**Scenario**: Developer wants to add a new email processing capability

**Rule Impact**:
1. **Console Output Rules (1.a.23)**: AI will suggest implementing proper status display with color-coded output showing processing progress
2. **Menu Dashboard Rules (1.a.24)**: AI will automatically add the new feature to the menu system with proper categorization
3. **Package Script Rules (1.a.28)**: AI will create npm scripts following the `mail:process:newfeature` naming convention
4. **CloudWatch Logging Rules (1.a.29)**: AI will implement structured JSON logging with proper correlation IDs
5. **Configuration Management Rules (1.a.32)**: AI will add configuration options to `config.json` with proper versioning

**Development Process Changes**:
- Developer will see consistent console output during development
- Feature will be immediately accessible through the menu system
- Configuration changes will be automatically backed up and versioned
- Logging will be comprehensive and searchable in CloudWatch

#### Example 2: Setting Up a New AWS Service
**Scenario**: Developer needs to integrate a new AWS service

**Rule Impact**:
1. **AWS Cloud Rules**: AI will suggest serverless-first approach using Lambda and API Gateway
2. **Terraform Rules**: AI will create infrastructure as code rather than manual setup
3. **Initialization Rules (1.a.31)**: AI will implement proper initialization procedures with validation
4. **Folder Naming Rules (1.a.33)**: AI will use consistent timestamp-based naming for deployment artifacts
5. **Configuration Management Rules (1.a.32)**: AI will create proper configuration management with rollback capabilities

**Development Process Changes**:
- No manual AWS console setup required
- Infrastructure changes are version-controlled and repeatable
- Configuration changes are automatically backed up
- Deployment artifacts are properly organized and timestamped

#### Example 3: Implementing AI Integration
**Scenario**: Developer wants to add AI capabilities to the system

**Rule Impact**:
1. **AI Integration Rules**: AI will default to OpenAI API calls with proper error handling
2. **Configuration Management Rules (1.a.32)**: AI will store API keys securely in configuration
3. **Console Output Rules (1.a.23)**: AI will implement proper status display for AI operations
4. **Testing Rules**: AI will create comprehensive testing for AI interactions
5. **Documentation Rules**: AI will document the AI integration with usage examples

**Development Process Changes**:
- AI integration will follow established patterns
- API keys will be managed securely without manual intervention
- AI operations will have clear status feedback
- Testing will cover both success and failure scenarios

#### Example 4: Creating a New Development Environment
**Scenario**: Developer needs to set up a new development environment

**Rule Impact**:
1. **Local Development Rules**: AI will provide automated setup scripts
2. **Initialization Rules (1.a.31)**: AI will implement proper local vs cloud initialization
3. **Configuration Management Rules (1.a.32)**: AI will create environment-specific configurations
4. **Menu Dashboard Rules (1.a.24)**: AI will add environment management to the menu system
5. **Documentation Rules**: AI will create setup documentation with troubleshooting guides

**Development Process Changes**:
- Environment setup will be fully automated
- Configuration will be properly versioned and backed up
- Environment management will be accessible through the menu
- Setup documentation will be comprehensive and up-to-date

#### Example 5: Implementing Error Handling
**Scenario**: Developer encounters an error and needs to implement proper error handling

**Rule Impact**:
1. **Console Output Rules (1.a.23)**: AI will suggest proper error display with color coding
2. **CloudWatch Logging Rules (1.a.29)**: AI will implement structured error logging
3. **Configuration Management Rules (1.a.32)**: AI will add error handling configuration options
4. **Testing Rules**: AI will create error scenario tests
5. **Documentation Rules**: AI will document error handling procedures

**Development Process Changes**:
- Errors will be displayed consistently across the application
- Error logs will be searchable and correlated in CloudWatch
- Error handling will be configurable and testable
- Error procedures will be documented for future reference

### Long-term Development Benefits

#### Consistency and Quality
- All code will follow established patterns, reducing review time
- Configuration management will prevent configuration drift
- Testing will be comprehensive and automated
- Documentation will be consistent and up-to-date

#### Productivity Improvements
- AI assistance will be more accurate and relevant
- Development setup will be faster and more reliable
- Error resolution will be more systematic
- Feature development will follow proven patterns

#### Operational Excellence
- Deployments will be more reliable and repeatable
- Monitoring will be comprehensive and actionable
- Rollback procedures will be tested and documented
- Security will be built-in rather than added later

## Troubleshooting

### Common Issues

#### Rules Not Loading
**Problem**: Cursor doesn't seem to follow the established rules
**Solution**:
1. Verify `.cursorrules` file exists in project root
2. Check that rule files exist in `Cursor/` directory
3. Restart Cursor completely
4. Start a new conversation

#### Inconsistent Behavior
**Problem**: AI assistance is inconsistent with project patterns
**Solution**:
1. Check rule file content for accuracy
2. Verify rule references in `.cursorrules`
3. Test with specific rule-related queries
4. Update rules if necessary

#### Setup Script Errors
**Problem**: Setup script fails to run
**Solution**:
1. Verify Node.js is installed and accessible
2. Check file permissions in project directory
3. Review error messages for specific issues
4. Run setup manually if needed

### Getting Help

#### Rule-Specific Questions
- Review the specific rule file for detailed information
- Check the rule file's examples and guidelines
- Test the rule with specific queries

#### General Questions
- Review this guide for usage information
- Check the project documentation for context
- Consult the backup logs for previous configurations

#### Technical Issues
- Check the setup logs in `data/cursor/`
- Review backup directories for previous configurations
- Verify file permissions and access

## Best Practices

### Rule Usage
1. **Be Specific**: Ask specific questions about project patterns
2. **Reference Rules**: Explicitly reference rule categories when needed
3. **Test Rules**: Verify rules work as expected with test queries
4. **Update Rules**: Keep rules updated with project changes

### Rule Maintenance
1. **Regular Reviews**: Review rules periodically for accuracy
2. **Update Documentation**: Keep this guide updated
3. **Backup Changes**: Always backup before making changes
4. **Test Changes**: Verify changes work as expected

### Rule Development
1. **Follow Patterns**: Use established patterns for new rules
2. **Be Comprehensive**: Cover all relevant aspects
3. **Include Examples**: Provide practical examples
4. **Maintain Consistency**: Ensure consistency across rules

## Conclusion

The Cursor rules system provides a comprehensive framework for maintaining consistent development practices across the Chatterbox project. By following the established patterns and procedures, developers can ensure high-quality, secure, and maintainable code while leveraging the full power of AI assistance.

For questions or issues with the rules system, refer to the troubleshooting section or consult the project documentation for additional context. 