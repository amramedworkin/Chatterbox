# Folder Naming Rules for Chatterbox

## Overview
This project follows comprehensive folder naming standards for consistency, readability, and maintainability. The rules ensure uniform naming conventions across all directories and files, with specific standards for timestamps and version management.

## Folder Naming Philosophy (1.a.33)

### 1. Naming Consistency
- **Uniform Standards**: Use consistent naming patterns across all folders
- **Readability**: Ensure folder names are easily readable and understandable
- **Descriptive**: Use descriptive names that clearly indicate folder purpose
- **Hierarchical**: Follow hierarchical naming conventions
- **Cross-Platform**: Ensure compatibility across different operating systems

### 2. Naming Principles
- **Lowercase**: Use lowercase letters for all folder names
- **Hyphens**: Use hyphens to separate words (kebab-case)
- **No Spaces**: Never use spaces in folder names
- **No Special Characters**: Avoid special characters except hyphens and underscores
- **Descriptive**: Use descriptive names that indicate content

## Timestamp Standards (1.a.33.i)

### 1. Timestamp Format
```javascript
// Standard timestamp format: yyyymmdd_hhmmss
const timestampFormat = {
    format: 'yyyymmdd_hhmmss',
    example: '20250804_143022',
    description: 'Year, month, day, hour, minute, second'
};

// Timestamp generation function
function generateTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

// Example timestamps
const timestampExamples = [
    '20250804_143022',  // August 4, 2025, 2:30:22 PM
    '20250715_090045',  // July 15, 2025, 9:00:45 AM
    '20250623_235959'   // June 23, 2025, 11:59:59 PM
];
```

### 2. Timestamp Usage Rules
```javascript
// Timestamp usage patterns
const timestampUsage = {
    // Backup folders
    'backup-20250804_143022': 'Backup with timestamp',
    'backup-aws-20250804_143022': 'AWS backup with timestamp',
    'backup-local-20250804_143022': 'Local backup with timestamp',
    
    // Version folders
    'awsinit-20250804_143022': 'AWS initialization version',
    'config-20250804_143022': 'Configuration version',
    'deployment-20250804_143022': 'Deployment version',
    
    // Log folders
    'logs-20250804_143022': 'Log files with timestamp',
    'error-logs-20250804_143022': 'Error logs with timestamp',
    'access-logs-20250804_143022': 'Access logs with timestamp',
    
    // Data folders
    'data-export-20250804_143022': 'Data export with timestamp',
    'data-import-20250804_143022': 'Data import with timestamp',
    'data-backup-20250804_143022': 'Data backup with timestamp'
};
```

### 3. Timestamp Validation
```javascript
// Timestamp validation function
function validateTimestamp(timestamp) {
    const timestampPattern = /^\d{8}_\d{6}$/;
    
    if (!timestampPattern.test(timestamp)) {
        throw new Error(`Invalid timestamp format: ${timestamp}. Expected format: yyyymmdd_hhmmss`);
    }
    
    // Validate date components
    const year = parseInt(timestamp.substring(0, 4));
    const month = parseInt(timestamp.substring(4, 6));
    const day = parseInt(timestamp.substring(6, 8));
    const hour = parseInt(timestamp.substring(9, 11));
    const minute = parseInt(timestamp.substring(11, 13));
    const second = parseInt(timestamp.substring(13, 15));
    
    // Validate ranges
    if (year < 2020 || year > 2030) {
        throw new Error(`Invalid year in timestamp: ${year}`);
    }
    
    if (month < 1 || month > 12) {
        throw new Error(`Invalid month in timestamp: ${month}`);
    }
    
    if (day < 1 || day > 31) {
        throw new Error(`Invalid day in timestamp: ${day}`);
    }
    
    if (hour < 0 || hour > 23) {
        throw new Error(`Invalid hour in timestamp: ${hour}`);
    }
    
    if (minute < 0 || minute > 59) {
        throw new Error(`Invalid minute in timestamp: ${minute}`);
    }
    
    if (second < 0 || second > 59) {
        throw new Error(`Invalid second in timestamp: ${second}`);
    }
    
    return true;
}
```

## Version Naming Standards (1.a.33.ii)

### 1. Current Version Naming
```javascript
// Current version naming patterns
const currentVersionNaming = {
    // AWS initialization
    'awsinit': 'Current AWS initialization configuration',
    'awsinit/': 'Current AWS initialization directory',
    
    // Configuration
    'config': 'Current configuration',
    'config/': 'Current configuration directory',
    
    // Deployment
    'deployment': 'Current deployment configuration',
    'deployment/': 'Current deployment directory',
    
    // Data
    'data': 'Current data directory',
    'data/': 'Current data directory',
    
    // Logs
    'logs': 'Current logs directory',
    'logs/': 'Current logs directory'
};
```

### 2. Historical Version Naming
```javascript
// Historical version naming patterns
const historicalVersionNaming = {
    // AWS initialization versions
    'awsinit-20250804_143022': 'AWS initialization version from August 4, 2025, 2:30:22 PM',
    'awsinit-20250715_090045': 'AWS initialization version from July 15, 2025, 9:00:45 AM',
    'awsinit-20250623_235959': 'AWS initialization version from June 23, 2025, 11:59:59 PM',
    
    // Configuration versions
    'config-20250804_143022': 'Configuration version from August 4, 2025, 2:30:22 PM',
    'config-20250715_090045': 'Configuration version from July 15, 2025, 9:00:45 AM',
    
    // Deployment versions
    'deployment-20250804_143022': 'Deployment version from August 4, 2025, 2:30:22 PM',
    'deployment-20250715_090045': 'Deployment version from July 15, 2025, 9:00:45 AM',
    
    // Backup versions
    'backup-20250804_143022': 'Backup version from August 4, 2025, 2:30:22 PM',
    'backup-aws-20250804_143022': 'AWS backup version from August 4, 2025, 2:30:22 PM',
    'backup-local-20250804_143022': 'Local backup version from August 4, 2025, 2:30:22 PM'
};
```

### 3. Version Management
```javascript
// Version management class
class VersionManager {
    constructor(basePath) {
        this.basePath = basePath;
    }
    
    async createVersion(versionType, description = '') {
        const timestamp = generateTimestamp();
        const versionName = `${versionType}-${timestamp}`;
        const versionPath = `${this.basePath}/${versionName}`;
        
        console.log(`📦 Creating version: ${versionName}`);
        
        try {
            // Create version directory
            require('fs').mkdirSync(versionPath, { recursive: true });
            
            // Copy current version to new version
            await this.copyCurrentToVersion(versionType, versionPath);
            
            // Create version metadata
            await this.createVersionMetadata(versionPath, versionName, description);
            
            console.log(`✅ Created version: ${versionPath}`);
            
            return versionPath;
        } catch (error) {
            console.error(`❌ Failed to create version: ${error.message}`);
            throw error;
        }
    }
    
    async copyCurrentToVersion(versionType, versionPath) {
        const currentPath = `${this.basePath}/${versionType}`;
        
        if (require('fs').existsSync(currentPath)) {
            this.copyDirectoryRecursive(currentPath, versionPath);
            console.log(`✅ Copied current ${versionType} to version directory`);
        } else {
            console.log(`⚠️  No current ${versionType} directory found`);
        }
    }
    
    async createVersionMetadata(versionPath, versionName, description) {
        const metadata = {
            version: versionName,
            created: new Date().toISOString(),
            description: description,
            environment: process.env.ENVIRONMENT || 'development',
            author: process.env.USER || 'unknown',
            gitCommit: this.getGitCommit(),
            gitBranch: this.getGitBranch()
        };
        
        const metadataPath = `${versionPath}/version-metadata.json`;
        require('fs').writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        
        console.log(`✅ Created version metadata: ${metadataPath}`);
    }
    
    async listVersions(versionType) {
        const versions = [];
        
        if (require('fs').existsSync(this.basePath)) {
            const items = require('fs').readdirSync(this.basePath);
            
            for (const item of items) {
                if (item.startsWith(`${versionType}-`) && item.match(/^\d{8}_\d{6}$/)) {
                    const itemPath = `${this.basePath}/${item}`;
                    const stats = require('fs').statSync(itemPath);
                    
                    if (stats.isDirectory()) {
                        const metadataPath = `${itemPath}/version-metadata.json`;
                        
                        if (require('fs').existsSync(metadataPath)) {
                            const metadata = JSON.parse(require('fs').readFileSync(metadataPath, 'utf8'));
                            versions.push({
                                name: item,
                                path: itemPath,
                                metadata: metadata
                            });
                        }
                    }
                }
            }
        }
        
        return versions.sort((a, b) => 
            new Date(b.metadata.created) - new Date(a.metadata.created)
        );
    }
    
    async rollbackToVersion(versionType, versionName) {
        console.log(`🔄 Rolling back to version: ${versionName}`);
        
        const versionPath = `${this.basePath}/${versionName}`;
        const currentPath = `${this.basePath}/${versionType}`;
        
        if (!require('fs').existsSync(versionPath)) {
            throw new Error(`Version not found: ${versionName}`);
        }
        
        try {
            // Create backup of current version
            await this.createVersion(versionType, 'Rollback backup');
            
            // Remove current version
            if (require('fs').existsSync(currentPath)) {
                require('fs').rmSync(currentPath, { recursive: true, force: true });
            }
            
            // Copy version to current
            this.copyDirectoryRecursive(versionPath, currentPath);
            
            console.log(`✅ Successfully rolled back to version: ${versionName}`);
        } catch (error) {
            console.error(`❌ Rollback failed: ${error.message}`);
            throw error;
        }
    }
    
    copyDirectoryRecursive(source, destination) {
        if (!require('fs').existsSync(destination)) {
            require('fs').mkdirSync(destination, { recursive: true });
        }
        
        const items = require('fs').readdirSync(source);
        
        for (const item of items) {
            const sourcePath = `${source}/${item}`;
            const destPath = `${destination}/${item}`;
            const stats = require('fs').statSync(sourcePath);
            
            if (stats.isDirectory()) {
                this.copyDirectoryRecursive(sourcePath, destPath);
            } else {
                require('fs').copyFileSync(sourcePath, destPath);
            }
        }
    }
    
    getGitCommit() {
        try {
            return require('child_process').execSync('git rev-parse HEAD').toString().trim();
        } catch (error) {
            return 'unknown';
        }
    }
    
    getGitBranch() {
        try {
            return require('child_process').execSync('git branch --show-current').toString().trim();
        } catch (error) {
            return 'unknown';
        }
    }
}
```

## Compression Capability Rules (1.a.33.iii)

### 1. Compression Standards
```javascript
// Compression standards for future versions
const compressionStandards = {
    // Compression formats
    formats: {
        'tar.gz': 'Standard Unix compression format',
        'zip': 'Cross-platform compression format',
        '7z': 'High compression ratio format'
    },
    
    // Compression rules
    rules: {
        'auto-compress': 'Automatically compress versions older than 30 days',
        'manual-compress': 'Allow manual compression of any version',
        'compression-level': 'Use maximum compression for historical versions',
        'preserve-metadata': 'Preserve all metadata during compression'
    },
    
    // Compression thresholds
    thresholds: {
        'auto-compress-days': 30,
        'compress-size-threshold': '100MB',
        'max-uncompressed-versions': 10
    }
};
```

### 2. Compression Implementation
```javascript
// Compression implementation
class CompressionManager {
    constructor(basePath) {
        this.basePath = basePath;
        this.compressionFormats = ['tar.gz', 'zip', '7z'];
    }
    
    async compressVersion(versionPath, format = 'tar.gz') {
        console.log(`🗜️  Compressing version: ${versionPath}`);
        
        try {
            const versionName = require('path').basename(versionPath);
            const compressedPath = `${versionPath}.${format}`;
            
            switch (format) {
                case 'tar.gz':
                    await this.compressTarGz(versionPath, compressedPath);
                    break;
                case 'zip':
                    await this.compressZip(versionPath, compressedPath);
                    break;
                case '7z':
                    await this.compress7z(versionPath, compressedPath);
                    break;
                default:
                    throw new Error(`Unsupported compression format: ${format}`);
            }
            
            // Remove original directory after successful compression
            require('fs').rmSync(versionPath, { recursive: true, force: true });
            
            console.log(`✅ Compressed version: ${compressedPath}`);
            
            return compressedPath;
        } catch (error) {
            console.error(`❌ Compression failed: ${error.message}`);
            throw error;
        }
    }
    
    async compressTarGz(sourcePath, destPath) {
        const tar = require('tar');
        
        await tar.create(
            {
                gzip: true,
                file: destPath,
                cwd: require('path').dirname(sourcePath)
            },
            [require('path').basename(sourcePath)]
        );
    }
    
    async compressZip(sourcePath, destPath) {
        const archiver = require('archiver');
        const output = require('fs').createWriteStream(destPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        return new Promise((resolve, reject) => {
            output.on('close', resolve);
            archive.on('error', reject);
            
            archive.pipe(output);
            archive.directory(sourcePath, require('path').basename(sourcePath));
            archive.finalize();
        });
    }
    
    async compress7z(sourcePath, destPath) {
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);
        
        await execAsync(`7z a -t7z -m0=lzma2 -mx=9 "${destPath}" "${sourcePath}"`);
    }
    
    async decompressVersion(compressedPath, format = 'tar.gz') {
        console.log(`📦 Decompressing version: ${compressedPath}`);
        
        try {
            const versionPath = compressedPath.replace(`.${format}`, '');
            
            switch (format) {
                case 'tar.gz':
                    await this.decompressTarGz(compressedPath, versionPath);
                    break;
                case 'zip':
                    await this.decompressZip(compressedPath, versionPath);
                    break;
                case '7z':
                    await this.decompress7z(compressedPath, versionPath);
                    break;
                default:
                    throw new Error(`Unsupported compression format: ${format}`);
            }
            
            // Remove compressed file after successful decompression
            require('fs').unlinkSync(compressedPath);
            
            console.log(`✅ Decompressed version: ${versionPath}`);
            
            return versionPath;
        } catch (error) {
            console.error(`❌ Decompression failed: ${error.message}`);
            throw error;
        }
    }
    
    async decompressTarGz(compressedPath, destPath) {
        const tar = require('tar');
        
        await tar.extract({
            file: compressedPath,
            cwd: require('path').dirname(destPath)
        });
    }
    
    async decompressZip(compressedPath, destPath) {
        const extract = require('extract-zip');
        
        await extract(compressedPath, { dir: require('path').dirname(destPath) });
    }
    
    async decompress7z(compressedPath, destPath) {
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);
        
        await execAsync(`7z x "${compressedPath}" -o"${require('path').dirname(destPath)}" -y`);
    }
    
    async autoCompressOldVersions(versionType, daysThreshold = 30) {
        console.log(`🗜️  Auto-compressing versions older than ${daysThreshold} days...`);
        
        const versions = await this.listVersions(versionType);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);
        
        const oldVersions = versions.filter(version => 
            new Date(version.metadata.created) < cutoffDate
        );
        
        for (const version of oldVersions) {
            if (!version.path.endsWith('.tar.gz') && 
                !version.path.endsWith('.zip') && 
                !version.path.endsWith('.7z')) {
                
                console.log(`🗜️  Auto-compressing: ${version.name}`);
                await this.compressVersion(version.path, 'tar.gz');
            }
        }
        
        console.log(`✅ Auto-compressed ${oldVersions.length} old versions`);
    }
    
    async listCompressedVersions(versionType) {
        const compressedVersions = [];
        
        if (require('fs').existsSync(this.basePath)) {
            const items = require('fs').readdirSync(this.basePath);
            
            for (const item of items) {
                if (item.startsWith(`${versionType}-`) && 
                    (item.endsWith('.tar.gz') || item.endsWith('.zip') || item.endsWith('.7z'))) {
                    
                    const itemPath = `${this.basePath}/${item}`;
                    const stats = require('fs').statSync(itemPath);
                    
                    compressedVersions.push({
                        name: item,
                        path: itemPath,
                        size: stats.size,
                        created: stats.birthtime,
                        format: this.getCompressionFormat(item)
                    });
                }
            }
        }
        
        return compressedVersions.sort((a, b) => 
            new Date(b.created) - new Date(a.created)
        );
    }
    
    getCompressionFormat(filename) {
        if (filename.endsWith('.tar.gz')) return 'tar.gz';
        if (filename.endsWith('.zip')) return 'zip';
        if (filename.endsWith('.7z')) return '7z';
        return 'unknown';
    }
}
```

## Folder Naming Validation

### 1. Naming Validation
```javascript
// Folder naming validation
class FolderNamingValidator {
    validateFolderName(folderName) {
        const validations = [
            this.validateLength(folderName),
            this.validateCharacters(folderName),
            this.validateFormat(folderName),
            this.validateReadability(folderName)
        ];
        
        const results = validations.map(validation => validation);
        const allValid = results.every(result => result.valid);
        
        if (!allValid) {
            const errors = results.filter(result => !result.valid);
            throw new Error(`Invalid folder name: ${folderName}. Errors: ${errors.map(e => e.message).join(', ')}`);
        }
        
        return true;
    }
    
    validateLength(folderName) {
        const maxLength = 255;
        const minLength = 1;
        
        if (folderName.length < minLength) {
            return { valid: false, message: `Folder name too short (minimum ${minLength} character)` };
        }
        
        if (folderName.length > maxLength) {
            return { valid: false, message: `Folder name too long (maximum ${maxLength} characters)` };
        }
        
        return { valid: true };
    }
    
    validateCharacters(folderName) {
        const validPattern = /^[a-z0-9\-_]+$/;
        
        if (!validPattern.test(folderName)) {
            return { valid: false, message: 'Folder name contains invalid characters (only lowercase letters, numbers, hyphens, and underscores allowed)' };
        }
        
        return { valid: true };
    }
    
    validateFormat(folderName) {
        // Check for timestamp format
        const timestampPattern = /^\d{8}_\d{6}$/;
        if (timestampPattern.test(folderName)) {
            return { valid: true };
        }
        
        // Check for version format
        const versionPattern = /^[a-z]+-\d{8}_\d{6}$/;
        if (versionPattern.test(folderName)) {
            return { valid: true };
        }
        
        // Check for standard format
        const standardPattern = /^[a-z]+(-[a-z]+)*$/;
        if (standardPattern.test(folderName)) {
            return { valid: true };
        }
        
        return { valid: false, message: 'Folder name does not follow naming conventions' };
    }
    
    validateReadability(folderName) {
        // Check for consecutive hyphens or underscores
        if (folderName.includes('--') || folderName.includes('__')) {
            return { valid: false, message: 'Folder name contains consecutive hyphens or underscores' };
        }
        
        // Check for leading or trailing hyphens or underscores
        if (folderName.startsWith('-') || folderName.startsWith('_') ||
            folderName.endsWith('-') || folderName.endsWith('_')) {
            return { valid: false, message: 'Folder name starts or ends with hyphen or underscore' };
        }
        
        return { valid: true };
    }
}
```

### 2. Automated Naming
```javascript
// Automated folder naming
class FolderNamingAutomator {
    constructor() {
        this.validator = new FolderNamingValidator();
    }
    
    generateFolderName(baseName, timestamp = null) {
        let folderName = baseName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        
        // Remove consecutive hyphens
        folderName = folderName.replace(/-+/g, '-');
        
        // Remove leading and trailing hyphens
        folderName = folderName.replace(/^-+|-+$/g, '');
        
        // Add timestamp if provided
        if (timestamp) {
            folderName = `${folderName}-${timestamp}`;
        }
        
        // Validate the generated name
        this.validator.validateFolderName(folderName);
        
        return folderName;
    }
    
    generateTimestampedFolderName(baseName) {
        const timestamp = generateTimestamp();
        return this.generateFolderName(baseName, timestamp);
    }
    
    generateVersionFolderName(versionType) {
        const timestamp = generateTimestamp();
        return `${versionType}-${timestamp}`;
    }
}
```

This comprehensive approach ensures consistent, readable, and maintainable folder naming across the project while providing robust version management and compression capabilities for future scalability. 