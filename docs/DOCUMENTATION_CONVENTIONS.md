# Documentation Naming Conventions

## Overview

This document defines the standardized naming conventions for all documentation files in the Chatterbox project. All documentation files should follow these conventions to ensure consistency, clarity, and ease of navigation.

## General Format

**Format**: `<PREFIX>_<CONTENT_DESCRIPTION>_<DOCTYPE>.md`

**Rules**:
- All names are in **UPPERCASE** (except the `.md` extension)
- Words are separated by underscores (`_`)
- Content descriptions use clear, descriptive terms
- Document types indicate the purpose and audience

## Document Type Categories

### Primary Document Types

| Type | Purpose | Examples |
|------|---------|----------|
| **GUIDE** | How-to instructions, step-by-step procedures | `AWS_SES_GUIDE.md`, `LOCAL_SYSTEM_CLEAN_GUIDE.md` |
| **README** | Overview, introduction, and reference documentation | `AWS_LAMBDA_README.md`, `GCP_SETUP_README.md` |
| **ARCHITECTURE** | System design, component relationships, technical architecture | `AWS_ARCHITECTURE_SUMMARY.md` |
| **SPEC** | Technical specifications, requirements, detailed specifications | `AWS_FINAL_PRODUCT_SPEC.md` |
| **SUMMARY** | Condensed information, executive summaries, overviews | `LOCAL_SYSTEM_BACKUP_SUMMARY.md` |
| **CONFIGURATION** | Configuration management, setup, parameters | `CONFIG_JSON_MANAGEMENT.md` |
| **VALIDATION** | Testing, verification, validation procedures | `LOCAL_VALIDATION.md` |
| **TROUBLESHOOTING** | Problem resolution, debugging, error handling | `AWS_TROUBLESHOOTING.md` |
| **MIGRATION** | Data migration, system migration, upgrade procedures | `AWS_MANUAL_SECRETS_MIGRATION_GUIDE.md` |
| **BACKUP** | Backup procedures, data protection, recovery | `AWS_BACKUP.md` |
| **TEARDOWN** | Cleanup, removal, decommissioning procedures | `AWS_TEARDOWN.md` |
| **TEST** | Testing procedures, test documentation | `AWS_LAMBDA_PROCESS_TEST.md` |
| **CREDENTIALS** | Authentication, authorization, security credentials | `AWS_CREDENTIALS.md`, `GCP_GET_CREDENTIALS.md` |
| **AUTHENTICATION** | Login, auth flows, security procedures | `GMAIL_AUTHENTICATION.md` |
| **SETUP** | Initial setup, installation, configuration | `OPENAI_SETUP.md` |
| **ORCHESTRATION** | System orchestration, workflow management | `SYSTEM_ORCHESTRATION_GUIDE.md` |
| **REQUIREMENTS** | System requirements, dependencies, prerequisites | `SYSTEM_REQUIREMENTS_CONSOLIDATION.md` |
| **OPERATION** | Operational procedures, day-to-day management | `OPERATION_GUIDE.md` |
| **SCRIPTS** | Script documentation, command reference | `SCRIPTS_README.md` |
| **CONVENTIONS** | Standards, conventions, guidelines | `DOCUMENTATION_CONVENTIONS.md` |

### Special Document Types

| Type | Purpose | Examples |
|------|---------|----------|
| **FLOW** | Process flows, workflows, sequence diagrams | `AWS_LAMBDA_FLOW_README.md` |
| **STATES** | State management, status tracking | `AWS_MESSAGE_STATES.md` |
| **PROCESSING** | Data processing, transformation procedures | `LOCAL_PROCESSING.md` |
| **MANAGEMENT** | Management procedures, administrative tasks | `LOCAL_STATE_MANAGEMENT.md` |
| **CONSOLIDATION** | Consolidated information, combined resources | `SYSTEM_REQUIREMENTS_CONSOLIDATION.md` |
| **IMPROVEMENTS** | Improvements, enhancements, optimizations | `AWS_BUILDOUT_IMPROVEMENTS.md` |
| **QUERY** | Query procedures, data retrieval | `AWS_QUERY_IDS.md` |
| **RESPONSE** | Response handling, output processing | `AWS_RESPONSE_PULLER.md` |
| **EMAIL** | Email-specific procedures, email processing | `AWS_EMAIL_PROCESSING_SUMMARY.md` |

## Prefix Categories

### Cloud Platform Prefixes

| Prefix | Platform | Examples |
|--------|----------|----------|
| **AWS_** | Amazon Web Services | `AWS_SES_GUIDE.md`, `AWS_LAMBDA_README.md` |
| **AZURE_** | Microsoft Azure | `AZURE_README.md` |
| **GCP_** | Google Cloud Platform | `GCP_SETUP_README.md`, `GCP_GET_CREDENTIALS.md` |

### System Component Prefixes

| Prefix | Component | Examples |
|--------|-----------|----------|
| **LOCAL_** | Local system components | `LOCAL_SYSTEM_CLEAN.md`, `LOCAL_VALIDATION.md` |
| **SYSTEM_** | System-wide components | `SYSTEM_ORCHESTRATION_GUIDE.md` |
| **CONFIG_** | Configuration components | `CONFIG_JSON_MANAGEMENT.md` |
| **GMAIL_** | Gmail integration | `GMAIL_AUTHENTICATION.md` |
| **OPENAI_** | OpenAI integration | `OPENAI_SETUP.md` |
| **SCRIPTS_** | Script documentation | `SCRIPTS_README.md` |

### Special Prefixes

| Prefix | Purpose | Examples |
|--------|---------|----------|
| **DOCUMENTATION_** | Documentation standards | `DOCUMENTATION_CONVENTIONS.md` |

## Content Description Guidelines

### Content Description Rules

1. **Be Specific**: Use precise, descriptive terms
   - ✅ `AWS_SES_GUIDE.md` (not `AWS_EMAIL_GUIDE.md`)
   - ✅ `LOCAL_SYSTEM_CLEAN.md` (not `LOCAL_CLEAN.md`)

2. **Use Nouns**: Content descriptions should be nouns or noun phrases
   - ✅ `AWS_LAMBDA_PROCESS_TEST.md`
   - ✅ `LOCAL_STATE_MANAGEMENT.md`

3. **Be Consistent**: Use consistent terminology across related documents
   - ✅ `AWS_LAMBDA_GUIDE.md` and `AWS_LAMBDA_README.md`
   - ✅ `LOCAL_SYSTEM_BACKUP.md` and `LOCAL_SYSTEM_BACKUP_SUMMARY.md`

4. **Avoid Abbreviations**: Use full words unless abbreviation is standard
   - ✅ `AWS_DYNAMODB_GUIDE.md` (DynamoDB is standard)
   - ✅ `CONFIG_JSON_MANAGEMENT.md` (JSON is standard)

### Common Content Descriptions

| Category | Examples |
|----------|----------|
| **System Components** | `SYSTEM`, `LOCAL_SYSTEM`, `AWS_LAMBDA`, `AWS_S3` |
| **Processes** | `PROCESS`, `FLOW`, `ORCHESTRATION`, `MIGRATION` |
| **Data** | `DATA`, `STATE`, `CONFIGURATION`, `CREDENTIALS` |
| **Operations** | `BACKUP`, `CLEAN`, `TEARDOWN`, `SETUP` |
| **Validation** | `VALIDATION`, `TEST`, `TROUBLESHOOTING` |
| **Documentation** | `REQUIREMENTS`, `ARCHITECTURE`, `SPECIFICATION` |

## File Organization

### Directory Structure

```
docs/
├── DOCUMENTATION_CONVENTIONS.md          # This document
├── SYSTEM_REQUIREMENTS_CONSOLIDATION.md  # System requirements
├── SYSTEM_SETUP_AND_TEARDOWN.md          # System setup/teardown
├── SYSTEM_ORCHESTRATION_GUIDE.md         # System orchestration
├── OPERATION_GUIDE.md                    # Operational procedures
├── SCRIPTS_README.md                     # Script documentation
├── CONFIG_JSON_MANAGEMENT.md             # Configuration management
├── Cloud/                                # Cloud platform documentation
│   ├── AWS/                              # AWS-specific documentation
│   ├── Azure/                            # Azure-specific documentation
│   └── GCP/                              # GCP-specific documentation
├── local/                                # Local system documentation
├── mail/                                 # Email integration documentation
├── openai/                               # OpenAI integration documentation
└── src/                                  # Source code documentation
    ├── mail/                             # Mail module documentation
    └── openai/                           # OpenAI module documentation
```

### Directory-Specific Conventions

#### Cloud Platform Documentation (`docs/Cloud/`)
- **Prefix**: Platform-specific prefix (`AWS_`, `AZURE_`, `GCP_`)
- **Organization**: By platform, then by component
- **Examples**:
  - `docs/Cloud/AWS/AWS_SES_GUIDE.md`
  - `docs/Cloud/GCP/GCP_SETUP_README.md`

#### Local System Documentation (`docs/local/`)
- **Prefix**: `LOCAL_`
- **Focus**: Local system components and procedures
- **Examples**:
  - `docs/local/LOCAL_SYSTEM_CLEAN.md`
  - `docs/local/LOCAL_VALIDATION.md`

#### Integration Documentation (`docs/mail/`, `docs/openai/`)
- **Prefix**: Integration-specific prefix (`GMAIL_`, `OPENAI_`)
- **Focus**: Integration setup and configuration
- **Examples**:
  - `docs/mail/GMAIL_AUTHENTICATION.md`
  - `docs/openai/OPENAI_SETUP.md`

#### Source Code Documentation (`docs/src/`)
- **Convention**: Use `README.md` for module overviews
- **Focus**: Code-specific documentation
- **Examples**:
  - `docs/src/mail/README.md`
  - `docs/src/openai/README.md`

## Migration Guidelines

### Current vs. Target Naming

| Current Pattern | Target Pattern | Example |
|----------------|----------------|---------|
| `COMPONENT_GUIDE.md` | `PREFIX_COMPONENT_GUIDE.md` | `LAMBDA_GUIDE.md` → `AWS_LAMBDA_GUIDE.md` |
| `COMPONENT_README.md` | `PREFIX_COMPONENT_README.md` | `GCP_README.md` → `GCP_SETUP_README.md` |
| `SUMMARY.md` | `PREFIX_CONTENT_SUMMARY.md` | `ARCHITECTURE_SUMMARY.md` → `AWS_ARCHITECTURE_SUMMARY.md` |
| `SPEC.md` | `PREFIX_CONTENT_SPEC.md` | `FINAL_PRODUCT_SPEC.md` → `AWS_FINAL_PRODUCT_SPEC.md` |

### Migration Priority

1. **High Priority**: Core system documentation
   - `SYSTEM_*` files
   - `AWS_*` files (already mostly compliant)
   - `LOCAL_*` files

2. **Medium Priority**: Integration documentation
   - `GMAIL_*` files
   - `OPENAI_*` files
   - `GCP_*` files

3. **Low Priority**: Source code documentation
   - `docs/src/` files (may keep `README.md` convention)

## Examples

### AWS Documentation Examples

| Current Name | Target Name | Type | Description |
|--------------|-------------|------|-------------|
| `AWS_SES_GUIDE.md` | `AWS_SES_GUIDE.md` | GUIDE | SES setup and configuration |
| `AWS_LAMBDA_README.md` | `AWS_LAMBDA_README.md` | README | Lambda function overview |
| `AWS_ARCHITECTURE_SUMMARY.md` | `AWS_ARCHITECTURE_SUMMARY.md` | ARCHITECTURE | System architecture |
| `AWS_FINAL_PRODUCT_SPEC.md` | `AWS_FINAL_PRODUCT_SPEC.md` | SPEC | Complete specification |

### Local System Examples

| Current Name | Target Name | Type | Description |
|--------------|-------------|------|-------------|
| `LOCAL_SYSTEM_CLEAN.md` | `LOCAL_SYSTEM_CLEAN_GUIDE.md` | GUIDE | Local system cleanup |
| `LOCAL_VALIDATION.md` | `LOCAL_VALIDATION_GUIDE.md` | VALIDATION | Local validation procedures |
| `LOCAL_SYSTEM_BACKUP_SUMMARY.md` | `LOCAL_SYSTEM_BACKUP_SUMMARY.md` | SUMMARY | Backup procedures summary |

### Integration Examples

| Current Name | Target Name | Type | Description |
|--------------|-------------|------|-------------|
| `GMAIL_AUTHENTICATION.md` | `GMAIL_AUTHENTICATION_GUIDE.md` | AUTHENTICATION | Gmail authentication |
| `OPENAI_SETUP.md` | `OPENAI_SETUP_GUIDE.md` | SETUP | OpenAI setup procedures |
| `GCP_SETUP_README.md` | `GCP_SETUP_README.md` | README | GCP setup overview |

## Compliance Checklist

### For New Documents

- [ ] Uses correct prefix for component/platform
- [ ] Uses descriptive content description
- [ ] Uses appropriate document type
- [ ] All uppercase with underscores
- [ ] `.md` extension
- [ ] Follows directory organization

### For Existing Documents

- [ ] Renamed to follow convention
- [ ] References updated throughout codebase
- [ ] Links in other documents updated
- [ ] README.md documentation table updated
- [ ] Menu.js references updated (if applicable)

## Enforcement

### Automated Checks

Consider implementing automated checks for:
- File naming compliance
- Broken internal links
- Missing documentation
- Inconsistent references

### Manual Review

Regular manual review of:
- New documentation files
- Updated documentation
- Cross-references between documents
- README.md documentation tables

## Conclusion

This naming convention ensures:
- **Consistency**: All documents follow the same pattern
- **Clarity**: Names clearly indicate content and purpose
- **Navigability**: Easy to find and understand document purpose
- **Scalability**: Convention works for new components and platforms
- **Maintainability**: Clear rules for future documentation

Follow these conventions for all new documentation and migrate existing documentation as part of regular maintenance cycles. 