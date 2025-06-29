# Chatterbox NPM Scripts Reference

This document provides a comprehensive reference for all available npm scripts in the Chatterbox project, organized by type and functionality.

## Script Categories

The scripts are organized into the following logical groups:

1. **Build & Development** - TypeScript compilation and development tools
2. **Code Quality** - Linting, formatting, and code cleanup
3. **Installation** - Create new installations and initialize systems
4. **Mail Operations** - Gmail polling, authorization, and validation
5. **Application Setup** - Initialization and environment setup
6. **Local Server** - Token site serving and management
7. **Local System Management** - Backup, clean, and restore operations
8. **AWS Infrastructure** - Complete AWS infrastructure management
9. **Testing** - All test scripts and console tools

## Script Reference Table

| Type | Name | Description | Call | Host |
|------|------|-------------|------|------|
| **Build & Development** |
| Build | build | Compile TypeScript and copy HTML assets | `npm run build` | Local |
| Build | build:mac | Mac-specific build process | `npm run build:mac` | Local |
| Build | build:windows | Windows-specific build process | `npm run build:windows` | Local |
| Build | build:clean | Clean dist and rebuild | `npm run build:clean` | Local |
| Clean | clean | PowerShell cleanup script | `npm run clean` | Local |
| Format | format | Format code with Prettier | `npm run format` | Local |
| **Code Quality** |
| Lint | lint | ESLint with auto-fix and cache | `npm run lint` | Local |
| Lint | lint:nofix | ESLint without auto-fix | `npm run lint:nofix` | Local |
| Lint | lint:nofix:nocache | ESLint without cache | `npm run lint:nofix:nocache` | Local |
| Lint | lint:nocache | ESLint with auto-fix, no cache | `npm run lint:nocache` | Local |
| **Installation** |
| Install | install:create | Create new Chatterbox installation | `npm run install:create` | Local |
| Install | install:init | Initialize system with all components | `npm run install:init` | Local |
| **Mail Operations** |
| Mail | mail:poll | Start timed Gmail polling | `npm run mail:poll` | Local |
| Mail | mail:poll:single | Single Gmail poll operation | `npm run mail:poll:single` | Local |
| Mail | mail:authorize | Authorize all Gmail accounts | `npm run mail:authorize` | Local |
| Mail | mail:validate | Validate Gmail authorization | `npm run mail:validate` | Local |
| **Application Setup** |
| App | app:init | Initialize application | `npm run app:init` | Local |
| App | app:init:mail | Initialize mail functionality | `npm run app:init:mail` | Local |
| App | app:setup:env | Setup environment variables | `npm run app:setup:env` | Local |
| **Local Server** |
| Serve | serve:start | Start token site server | `npm run serve:start` | Local |
| Serve | serve:stop | Stop token site server | `npm run serve:stop` | Local |
| Serve | serve:restart | Restart token site server | `npm run serve:restart` | Local |
| **Local System Management** |
| Backup | backup:local | Interactive local system backup | `npm run backup:local` | Local |
| Backup | backup:local:force | Force backup without prompts | `npm run backup:local:force` | Local |
| Backup | backup:local:custom | Backup to custom directory | `npm run backup:local:custom` | Local |
| Backup | backup:local:with-name | Backup with custom name | `npm run backup:local:with-name` | Local |
| Backup | backup:local:with-notes | Backup with custom notes | `npm run backup:local:with-notes` | Local |
| Clean | clean:local | Interactive local system clean | `npm run clean:local` | Local |
| Clean | clean:local:force | Force clean with global confirmation | `npm run clean:local:force` | Local |
| Clean | clean:local:wipe | Clean without backups | `npm run clean:local:wipe` | Local |
| Clean | clean:local:force:wipe | Force wipe without confirmations | `npm run clean:local:force:wipe` | Local |
| Clean | clean:local:backup | Clean with custom backup directory | `npm run clean:local:backup` | Local |
| Clean | clean:local:with-name | Clean with custom name | `npm run clean:local:with-name` | Local |
| Clean | clean:local:with-notes | Clean with custom notes | `npm run clean:local:with-notes` | Local |
| Restore | restore:local | Interactive local system restore | `npm run restore:local` | Local |
| Restore | restore:local:force | Force restore without prompts | `npm run restore:local:force` | Local |
| Restore | restore:local:custom | Restore from custom directory | `npm run restore:local:custom` | Local |
| **AWS Infrastructure - Setup & Configuration** |
| AWS | aws:check-prerequisites | Check AWS prerequisites | `npm run aws:check-prerequisites` | AWS |
| AWS | aws:setup-user | Setup AWS user | `npm run aws:setup-user` | AWS |
| AWS | aws:configure | Configure AWS CLI | `npm run aws:configure` | AWS |
| AWS | aws:setup-backend | Setup Terraform backend | `npm run aws:setup-backend` | AWS |
| AWS | aws:setup | Complete AWS setup | `npm run aws:setup` | AWS |
| **AWS Infrastructure - Terraform Core** |
| AWS | aws:init | Initialize Terraform | `npm run aws:init` | AWS |
| AWS | aws:validate | Validate Terraform configuration | `npm run aws:validate` | AWS |
| AWS | aws:format | Format Terraform code | `npm run aws:format` | AWS |
| AWS | aws:format:check | Check Terraform formatting | `npm run aws:format:check` | AWS |
| AWS | aws:plan | Create Terraform plan | `npm run aws:plan` | AWS |
| AWS | aws:plan:show | Show Terraform plan | `npm run aws:plan:show` | AWS |
| AWS | aws:plan:summary | Show plan summary | `npm run aws:plan:summary` | AWS |
| AWS | aws:apply | Apply Terraform plan | `npm run aws:apply` | AWS |
| AWS | aws:apply:auto | Auto-apply Terraform plan | `npm run aws:apply:auto` | AWS |
| AWS | aws:deploy | Deploy with plan review | `npm run aws:deploy` | AWS |
| AWS | aws:deploy:auto | Auto-deploy infrastructure | `npm run aws:deploy:auto` | AWS |
| **AWS Infrastructure - State & Output** |
| AWS | aws:output | Show Terraform outputs | `npm run aws:output` | AWS |
| AWS | aws:output:json | Show outputs as JSON | `npm run aws:output:json` | AWS |
| AWS | aws:state:list | List Terraform state | `npm run aws:state:list` | AWS |
| AWS | aws:state:show | Show Terraform state | `npm run aws:state:show` | AWS |
| **AWS Infrastructure - Destruction** |
| AWS | aws:destroy | Destroy infrastructure | `npm run aws:destroy` | AWS |
| AWS | aws:destroy:auto | Auto-destroy infrastructure | `npm run aws:destroy:auto` | AWS |
| AWS | aws:teardown | Interactive infrastructure teardown | `npm run aws:teardown` | AWS |
| **AWS Infrastructure - Advanced Terraform** |
| AWS | aws:force-unlock | Force unlock Terraform state | `npm run aws:force-unlock` | AWS |
| AWS | aws:refresh | Refresh Terraform state | `npm run aws:refresh` | AWS |
| AWS | aws:import | Import resources to state | `npm run aws:import` | AWS |
| AWS | aws:taint | Taint Terraform resources | `npm run aws:taint` | AWS |
| AWS | aws:untaint | Untaint Terraform resources | `npm run aws:untaint` | AWS |
| AWS | aws:console | Open Terraform console | `npm run aws:console` | AWS |
| AWS | aws:graph | Generate Terraform graph | `npm run aws:graph` | AWS |
| **AWS Infrastructure - Workspaces** |
| AWS | aws:workspace:list | List Terraform workspaces | `npm run aws:workspace:list` | AWS |
| AWS | aws:workspace:new | Create new workspace | `npm run aws:workspace:new` | AWS |
| AWS | aws:workspace:select | Select workspace | `npm run aws:workspace:select` | AWS |
| AWS | aws:workspace:delete | Delete workspace | `npm run aws:workspace:delete` | AWS |
| **AWS Infrastructure - Testing** |
| AWS | aws:validate:infrastructure | Validate deployed infrastructure | `npm run aws:validate:infrastructure` | AWS |
| AWS | aws:test:resources | Test all AWS resources | `npm run aws:test:resources` | AWS |
| AWS | aws:test:vpc | Test VPC configuration | `npm run aws:test:vpc` | AWS |
| AWS | aws:test:dynamodb | Test DynamoDB tables | `npm run aws:test:dynamodb` | AWS |
| AWS | aws:test:s3 | Test S3 buckets | `npm run aws:test:s3` | AWS |
| AWS | aws:test:secrets | Test Secrets Manager | `npm run aws:test:secrets` | AWS |
| AWS | aws:test:parameters | Test Parameter Store | `npm run aws:test:parameters` | AWS |
| AWS | aws:test:iam | Test IAM policies | `npm run aws:test:iam` | AWS |
| AWS | aws:test:cloudwatch | Test CloudWatch | `npm run aws:test:cloudwatch` | AWS |
| AWS | aws:test:all | Run all AWS tests | `npm run aws:test:all` | AWS |
| **AWS Infrastructure - Cleanup** |
| AWS | aws:cleanup | Cleanup AWS resources | `npm run aws:cleanup` | AWS |
| AWS | aws:cleanup:user | Cleanup AWS user | `npm run aws:cleanup:user` | AWS |
| AWS | aws:cleanup:bucket | Cleanup S3 bucket | `npm run aws:cleanup:bucket` | AWS |
| **AWS Infrastructure - Secrets Management** |
| AWS | aws:migrate:secrets | Migrate secrets to AWS | `npm run aws:migrate:secrets` | Both |
| AWS | aws:smart-migrate | Smart secrets migration | `npm run aws:smart-migrate` | Both |
| AWS | aws:update:secret | Update individual secret | `npm run aws:update:secret` | AWS |
| AWS | aws:rotate:secrets | Rotate AWS secrets | `npm run aws:rotate:secrets` | AWS |
| AWS | aws:secrets:status | Check secrets status | `npm run aws:secrets:status` | AWS |
| **AWS Infrastructure - Environment Management** |
| AWS | aws:env:deploy | Deploy environment | `npm run aws:env:deploy` | AWS |
| AWS | aws:env:destroy | Destroy environment | `npm run aws:env:destroy` | AWS |
| AWS | aws:env:list | List environments | `npm run aws:env:list` | AWS |
| AWS | aws:env:status | Check environment status | `npm run aws:env:status` | AWS |
| AWS | aws:env:deploy:dev | Deploy development environment | `npm run aws:env:deploy:dev` | AWS |
| AWS | aws:env:deploy:staging | Deploy staging environment | `npm run aws:env:deploy:staging` | AWS |
| AWS | aws:env:deploy:prod | Deploy production environment | `npm run aws:env:deploy:prod` | AWS |
| AWS | aws:env:destroy:dev | Destroy development environment | `npm run aws:env:destroy:dev` | AWS |
| AWS | aws:env:destroy:staging | Destroy staging environment | `npm run aws:env:destroy:staging` | AWS |
| AWS | aws:env:destroy:prod | Destroy production environment | `npm run aws:env:destroy:prod` | AWS |
| AWS | aws:migrate:secrets:env | Migrate secrets for environment | `npm run aws:migrate:secrets:env` | Both |
| AWS | aws:migrate:secrets:env:dev | Migrate secrets to dev | `npm run aws:migrate:secrets:env:dev` | Both |
| AWS | aws:migrate:secrets:env:staging | Migrate secrets to staging | `npm run aws:migrate:secrets:env:staging` | Both |
| AWS | aws:migrate:secrets:env:prod | Migrate secrets to prod | `npm run aws:migrate:secrets:env:prod` | Both |
| **AWS Infrastructure - Logging & Debugging** |
| AWS | aws:logs:enable | Enable Terraform debug logs | `npm run aws:logs:enable` | AWS |
| AWS | aws:logs:disable | Disable Terraform debug logs | `npm run aws:logs:disable` | AWS |
| AWS | aws:logs:show | Show Terraform logs | `npm run aws:logs:show` | AWS |
| AWS | aws:logs:clear | Clear Terraform logs | `npm run aws:logs:clear` | AWS |
| AWS | aws:debug:plan | Debug Terraform plan | `npm run aws:debug:plan` | AWS |
| AWS | aws:debug:apply | Debug Terraform apply | `npm run aws:debug:apply` | AWS |
| **AWS Infrastructure - Advanced Features** |
| AWS | aws:cost:estimate | Estimate AWS costs | `npm run aws:cost:estimate` | AWS |
| AWS | aws:cost:analyze | Analyze AWS costs | `npm run aws:cost:analyze` | AWS |
| AWS | aws:security:audit | Audit AWS security | `npm run aws:security:audit` | AWS |
| AWS | aws:security:scan | Scan AWS security | `npm run aws:security:scan` | AWS |
| AWS | aws:backup:create | Create AWS backup | `npm run aws:backup:create` | AWS |
| AWS | aws:backup:restore | Restore AWS backup | `npm run aws:backup:restore` | AWS |
| AWS | aws:backup:list | List AWS backups | `npm run aws:backup:list` | AWS |
| AWS | aws:monitor:setup | Setup AWS monitoring | `npm run aws:monitor:setup` | AWS |
| AWS | aws:monitor:dashboard | Access monitoring dashboard | `npm run aws:monitor:dashboard` | AWS |
| AWS | aws:monitor:alarms | Manage monitoring alarms | `npm run aws:monitor:alarms` | AWS |
| AWS | aws:update:variables | Update Terraform variables | `npm run aws:update:variables` | AWS |
| AWS | aws:update:backend | Update Terraform backend | `npm run aws:update:backend` | AWS |
| AWS | aws:update:modules | Update Terraform modules | `npm run aws:update:modules` | AWS |
| AWS | aws:docs:generate | Generate AWS documentation | `npm run aws:docs:generate` | AWS |
| AWS | aws:docs:validate | Validate AWS documentation | `npm run aws:docs:validate` | AWS |
| **AWS Infrastructure - CI/CD** |
| AWS | aws:ci:setup | CI setup for AWS | `npm run aws:ci:setup` | AWS |
| AWS | aws:ci:validate | CI validation for AWS | `npm run aws:ci:validate` | AWS |
| AWS | aws:ci:plan | CI plan for AWS | `npm run aws:ci:plan` | AWS |
| AWS | aws:ci:apply | CI apply for AWS | `npm run aws:ci:apply` | AWS |
| AWS | aws:ci:test | CI testing for AWS | `npm run aws:ci:test` | AWS |
| AWS | aws:ci:cleanup | CI cleanup for AWS | `npm run aws:ci:cleanup` | AWS |
| **AWS Infrastructure - Environment Workflows** |
| AWS | aws:dev:setup | Setup development environment | `npm run aws:dev:setup` | AWS |
| AWS | aws:dev:deploy | Deploy to development | `npm run aws:dev:deploy` | AWS |
| AWS | aws:dev:test | Test development environment | `npm run aws:dev:test` | AWS |
| AWS | aws:dev:cleanup | Cleanup development environment | `npm run aws:dev:cleanup` | AWS |
| AWS | aws:prod:setup | Setup production environment | `npm run aws:prod:setup` | AWS |
| AWS | aws:prod:deploy | Deploy to production | `npm run aws:prod:deploy` | AWS |
| AWS | aws:prod:validate | Validate production environment | `npm run aws:prod:validate` | AWS |
| AWS | aws:prod:monitor | Setup production monitoring | `npm run aws:prod:monitor` | AWS |
| AWS | aws:prod:backup | Create production backup | `npm run aws:prod:backup` | AWS |
| AWS | aws:prod:security | Audit production security | `npm run aws:prod:security` | AWS |
| AWS | aws:prod:cost | Analyze production costs | `npm run aws:prod:cost` | AWS |
| **Testing** |
| Test | test:all | Run all tests | `npm run test:all` | Local |
| Test | test:completion | Test OpenAI completion | `npm run test:completion` | Local |
| Test | test:dialog | Test dialog agent | `npm run test:dialog` | Local |
| Test | test:dialog:basic | Basic dialog test | `npm run test:dialog:basic` | Local |
| Test | test:dialog:custom | Custom dialog test | `npm run test:dialog:custom` | Local |
| Test | test:dialog:model | Dialog model test | `npm run test:dialog:model` | Local |
| Test | test:emailAgent | Test email agent | `npm run test:emailAgent` | Local |
| Test | test:agent | Test ask agent | `npm run test:agent` | Local |
| Test | test:agent:basic | Basic agent test | `npm run test:agent:basic` | Local |
| Test | test:agent:native | Native agent test | `npm run test:agent:native` | Local |
| Test | test:agent:custom | Custom agent test | `npm run test:agent:custom` | Local |
| Test | test:send:basic | Basic send test | `npm run test:send:basic` | Local |
| Test | test:send:with-id | Send test with ID | `npm run test:send:with-id` | Local |
| Test | test:send:with-attachments | Send test with attachments | `npm run test:send:with-attachments` | Local |
| Test | test:send:custom-addresses | Send test with custom addresses | `npm run test:send:custom-addresses` | Local |
| Test | test:send:clean | Clean send test | `npm run test:send:clean` | Local |
| Test | test:send:list-ids | List send test IDs | `npm run test:send:list-ids` | Local |
| Test | test:send:help | Show send test help | `npm run test:send:help` | Local |
| Test | test:get | Test get mail | `npm run test:get` | Local |
| Test | test:get:ids | Test get mail by IDs | `npm run test:get:ids` | Local |
| Test | test:get:chatterbox | Test get chatterbox mail | `npm run test:get:chatterbox` | Local |
| Test | test:get:conversations | Test get conversations | `npm run test:get:conversations` | Local |
| Test | test:get:byid | Test get mail by ID | `npm run test:get:byid` | Local |
| Test | test:get:byids | Test get mail by IDs | `npm run test:get:byids` | Local |
| Test | test:get:range | Test get mail by range | `npm run test:get:range` | Local |
| Test | test:get:chatterboxrange | Test get chatterbox range | `npm run test:get:chatterboxrange` | Local |
| Test | test:get:conversationrange | Test get conversation range | `npm run test:get:conversationrange` | Local |
| Test | test:get:helpers | Test get mail helpers | `npm run test:get:helpers` | Local |
| Test | test:get:bysender | Test get mail by sender | `npm run test:get:bysender` | Local |
| Test | test:get:chatterboxbysender | Test get chatterbox by sender | `npm run test:get:chatterboxbysender` | Local |
| Test | test:get:rangebysender | Test get range by sender | `npm run test:get:rangebysender` | Local |
| Test | test:get:chatterboxrangebysender | Test get chatterbox range by sender | `npm run test:get:chatterboxrangebysender` | Local |
| Console | console:dialog | Interactive dialog console | `npm run console:dialog` | Local |
| Console | console:dialog:build | Build dialog console | `npm run console:dialog:build` | Local |
| **Configuration** |
| Config | config:dump | Dump all configuration variables | `npm run config:dump` | Local |
| Config | config:show | Show configuration (alias for dump) | `npm run config:show` | Local |

## Host Types

- **Local**: Scripts that run on the local development machine
- **AWS**: Scripts that interact with AWS infrastructure
- **Both**: Scripts that work with both local and AWS resources
- **NA**: Scripts that don't require any specific host (e.g., documentation)

## Quick Reference

### Essential Development Workflow
```bash
npm run build          # Build the project
npm run lint           # Check code quality
npm run test:all       # Run all tests
```

### AWS Infrastructure Workflow
```bash
npm run aws:setup      # Initial AWS setup
npm run aws:deploy     # Deploy infrastructure
npm run aws:test:all   # Test infrastructure
```

### Local System Management
```bash
npm run backup:local   # Backup local system
npm run clean:local    # Clean local system
npm run restore:local  # Restore from backup
```

### Mail Operations
```bash
npm run mail:authorize # Authorize Gmail
npm run mail:poll      # Start polling
```

## Notes

- All AWS scripts require proper AWS credentials and configuration
- Local system management scripts include interactive prompts for safety
- Test scripts can be run individually or as a group
- Some scripts support additional command-line parameters (see individual script help)
