# CloudWatch Logging Rules for Chatterbox

## Overview
This project follows comprehensive CloudWatch logging standards for centralized logging, monitoring, and observability. The rules ensure consistent logging patterns, proper log management, and effective use of CloudWatch features.

## CloudWatch Logging Philosophy (1.a.29)

### 1. Centralized Logging Strategy
- **Single Source of Truth**: All logs centralized in CloudWatch
- **Structured Logging**: Use structured JSON format for all logs
- **Consistent Patterns**: Follow consistent logging patterns across all components
- **Comprehensive Coverage**: Log all significant events and operations
- **Performance Monitoring**: Monitor performance through logging

### 2. Logging Standards
- **Log Levels**: Use appropriate log levels (ERROR, WARN, INFO, DEBUG)
- **Context Information**: Include relevant context with all log entries
- **Correlation IDs**: Use correlation IDs to track operations across services
- **Timestamps**: Include precise timestamps for all log entries
- **Metadata**: Include relevant metadata with log entries

## CloudWatch Logging Implementation (1.a.29.i)

### 1. Standard Logging Pattern
```javascript
// Standard CloudWatch logging pattern
const AWS = require('aws-sdk');
const cloudwatchLogs = new AWS.CloudWatchLogs();

class CloudWatchLogger {
    constructor(logGroupName, logStreamName) {
        this.logGroupName = logGroupName;
        this.logStreamName = logStreamName;
        this.sequenceToken = null;
    }
    
    async log(level, message, metadata = {}) {
        const logEntry = {
            timestamp: Date.now(),
            level: level,
            message: message,
            correlationId: metadata.correlationId || this.generateCorrelationId(),
            service: metadata.service || 'chatterbox',
            component: metadata.component || 'unknown',
            userId: metadata.userId,
            requestId: metadata.requestId,
            ...metadata
        };
        
        const params = {
            logGroupName: this.logGroupName,
            logStreamName: this.logStreamName,
            logEvents: [{
                timestamp: logEntry.timestamp,
                message: JSON.stringify(logEntry)
            }]
        };
        
        if (this.sequenceToken) {
            params.sequenceToken = this.sequenceToken;
        }
        
        try {
            const result = await cloudwatchLogs.putLogEvents(params).promise();
            this.sequenceToken = result.nextSequenceToken;
        } catch (error) {
            if (error.code === 'InvalidSequenceTokenException') {
                this.sequenceToken = error.message.match(/sequenceToken is: (.+)/)[1];
                await this.log(level, message, metadata);
            } else {
                console.error('Failed to log to CloudWatch:', error);
            }
        }
    }
    
    async error(message, metadata = {}) {
        return this.log('ERROR', message, metadata);
    }
    
    async warn(message, metadata = {}) {
        return this.log('WARN', message, metadata);
    }
    
    async info(message, metadata = {}) {
        return this.log('INFO', message, metadata);
    }
    
    async debug(message, metadata = {}) {
        return this.log('DEBUG', message, metadata);
    }
    
    generateCorrelationId() {
        return `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
```

### 2. Log Group Organization
```javascript
// Log group naming convention
const logGroupNaming = {
    // Application logs
    '/aws/lambda/chatterbox-email-processor': 'Email processing Lambda logs',
    '/aws/lambda/chatterbox-response-generator': 'Response generation Lambda logs',
    '/aws/lambda/chatterbox-email-round-trip-tester': 'Email testing Lambda logs',
    
    // API Gateway logs
    '/aws/apigateway/chatterbox-api': 'API Gateway access logs',
    
    // Application logs
    '/chatterbox/application': 'Application logs',
    '/chatterbox/email': 'Email system logs',
    '/chatterbox/ai': 'AI integration logs',
    '/chatterbox/aws': 'AWS service logs',
    
    // Error logs
    '/chatterbox/errors': 'Error logs',
    '/chatterbox/security': 'Security logs',
    '/chatterbox/performance': 'Performance logs'
};
```

### 3. Log Stream Naming
```javascript
// Log stream naming convention
const logStreamNaming = {
    // Lambda function streams
    'lambda-function-name/YYYY/MM/DD/HH': 'Hourly Lambda function streams',
    
    // Application streams
    'application/instance-id/YYYY/MM/DD': 'Daily application streams',
    
    // Service streams
    'service-name/environment/YYYY/MM/DD': 'Daily service streams',
    
    // Error streams
    'errors/YYYY/MM/DD': 'Daily error streams'
};
```

## CloudWatch Management (1.a.29.ii)

### 1. Log Group Management
```javascript
// Log group management functions
class CloudWatchManager {
    constructor() {
        this.cloudwatchLogs = new AWS.CloudWatchLogs();
    }
    
    async createLogGroup(logGroupName, tags = {}) {
        const params = {
            logGroupName: logGroupName,
            tags: {
                Service: 'chatterbox',
                Environment: process.env.ENVIRONMENT || 'development',
                ...tags
            }
        };
        
        try {
            await this.cloudwatchLogs.createLogGroup(params).promise();
            console.log(`Created log group: ${logGroupName}`);
        } catch (error) {
            if (error.code !== 'ResourceAlreadyExistsException') {
                throw error;
            }
        }
    }
    
    async deleteLogGroup(logGroupName) {
        const params = { logGroupName };
        
        try {
            await this.cloudwatchLogs.deleteLogGroup(params).promise();
            console.log(`Deleted log group: ${logGroupName}`);
        } catch (error) {
            console.error(`Failed to delete log group ${logGroupName}:`, error);
        }
    }
    
    async listLogGroups(prefix = '/chatterbox') {
        const params = { logGroupNamePrefix: prefix };
        
        try {
            const result = await this.cloudwatchLogs.describeLogGroups(params).promise();
            return result.logGroups;
        } catch (error) {
            console.error('Failed to list log groups:', error);
            return [];
        }
    }
}
```

### 2. Log Retention Management
```javascript
// Log retention configuration
const logRetentionConfig = {
    // Application logs
    '/chatterbox/application': 30, // 30 days
    '/chatterbox/email': 90,       // 90 days
    '/chatterbox/ai': 30,          // 30 days
    '/chatterbox/aws': 90,         // 90 days
    
    // Error logs
    '/chatterbox/errors': 365,     // 1 year
    '/chatterbox/security': 730,   // 2 years
    '/chatterbox/performance': 90, // 90 days
    
    // Lambda logs
    '/aws/lambda/chatterbox-email-processor': 30,
    '/aws/lambda/chatterbox-response-generator': 30,
    '/aws/lambda/chatterbox-email-round-trip-tester': 30,
    
    // API Gateway logs
    '/aws/apigateway/chatterbox-api': 90
};

// Set log retention
async function setLogRetention(logGroupName, retentionInDays) {
    const cloudwatchLogs = new AWS.CloudWatchLogs();
    
    const params = {
        logGroupName,
        retentionInDays
    };
    
    try {
        await cloudwatchLogs.putRetentionPolicy(params).promise();
        console.log(`Set retention policy for ${logGroupName}: ${retentionInDays} days`);
    } catch (error) {
        console.error(`Failed to set retention policy for ${logGroupName}:`, error);
    }
}
```

### 3. Log Stream Management
```javascript
// Log stream management
class LogStreamManager {
    constructor(logGroupName) {
        this.logGroupName = logGroupName;
        this.cloudwatchLogs = new AWS.CloudWatchLogs();
    }
    
    async createLogStream(logStreamName) {
        const params = {
            logGroupName: this.logGroupName,
            logStreamName
        };
        
        try {
            await this.cloudwatchLogs.createLogStream(params).promise();
            console.log(`Created log stream: ${logStreamName}`);
        } catch (error) {
            if (error.code !== 'ResourceAlreadyExistsException') {
                throw error;
            }
        }
    }
    
    async listLogStreams(prefix = '') {
        const params = {
            logGroupName: this.logGroupName,
            logStreamNamePrefix: prefix
        };
        
        try {
            const result = await this.cloudwatchLogs.describeLogStreams(params).promise();
            return result.logStreams;
        } catch (error) {
            console.error('Failed to list log streams:', error);
            return [];
        }
    }
    
    async deleteLogStream(logStreamName) {
        const params = {
            logGroupName: this.logGroupName,
            logStreamName
        };
        
        try {
            await this.cloudwatchLogs.deleteLogStream(params).promise();
            console.log(`Deleted log stream: ${logStreamName}`);
        } catch (error) {
            console.error(`Failed to delete log stream ${logStreamName}:`, error);
        }
    }
}
```

## CloudWatch Features Usage (1.a.29.iii)

### 1. CloudWatch Metrics
```javascript
// CloudWatch metrics integration
const cloudwatch = new AWS.CloudWatch();

class MetricsLogger {
    async putMetric(namespace, metricName, value, unit = 'Count', dimensions = []) {
        const params = {
            Namespace: namespace,
            MetricData: [{
                MetricName: metricName,
                Value: value,
                Unit: unit,
                Dimensions: dimensions,
                Timestamp: new Date()
            }]
        };
        
        try {
            await cloudwatch.putMetricData(params).promise();
        } catch (error) {
            console.error('Failed to put metric data:', error);
        }
    }
    
    async putCustomMetric(metricName, value, metadata = {}) {
        const dimensions = [
            {
                Name: 'Service',
                Value: 'chatterbox'
            },
            {
                Name: 'Environment',
                Value: process.env.ENVIRONMENT || 'development'
            }
        ];
        
        // Add custom dimensions
        Object.entries(metadata).forEach(([key, value]) => {
            dimensions.push({
                Name: key,
                Value: value.toString()
            });
        });
        
        return this.putMetric('Chatterbox/Custom', metricName, value, 'Count', dimensions);
    }
    
    async logEmailProcessed(emailId, processingTime) {
        await this.putCustomMetric('EmailsProcessed', 1, { emailId });
        await this.putCustomMetric('EmailProcessingTime', processingTime, { emailId });
    }
    
    async logError(errorType, errorMessage) {
        await this.putCustomMetric('Errors', 1, { 
            errorType, 
            errorMessage: errorMessage.substring(0, 100) 
        });
    }
}
```

### 2. CloudWatch Alarms
```javascript
// CloudWatch alarms configuration
const alarmConfig = {
    // Error rate alarms
    'HighErrorRate': {
        metricName: 'Errors',
        threshold: 10,
        period: 300, // 5 minutes
        evaluationPeriods: 2,
        comparisonOperator: 'GreaterThanThreshold',
        alarmDescription: 'High error rate detected'
    },
    
    // Performance alarms
    'HighProcessingTime': {
        metricName: 'EmailProcessingTime',
        threshold: 30000, // 30 seconds
        period: 300,
        evaluationPeriods: 2,
        comparisonOperator: 'GreaterThanThreshold',
        alarmDescription: 'High email processing time detected'
    },
    
    // Throughput alarms
    'LowThroughput': {
        metricName: 'EmailsProcessed',
        threshold: 1,
        period: 600, // 10 minutes
        evaluationPeriods: 2,
        comparisonOperator: 'LessThanThreshold',
        alarmDescription: 'Low email processing throughput detected'
    }
};

// Create CloudWatch alarms
async function createAlarm(alarmName, config) {
    const params = {
        AlarmName: `chatterbox-${alarmName}`,
        ComparisonOperator: config.comparisonOperator,
        EvaluationPeriods: config.evaluationPeriods,
        MetricName: config.metricName,
        Namespace: 'Chatterbox/Custom',
        Period: config.period,
        Threshold: config.threshold,
        AlarmDescription: config.alarmDescription,
        Dimensions: [
            {
                Name: 'Service',
                Value: 'chatterbox'
            },
            {
                Name: 'Environment',
                Value: process.env.ENVIRONMENT || 'development'
            }
        ]
    };
    
    try {
        await cloudwatch.putMetricAlarm(params).promise();
        console.log(`Created alarm: ${alarmName}`);
    } catch (error) {
        console.error(`Failed to create alarm ${alarmName}:`, error);
    }
}
```

### 3. CloudWatch Dashboards
```javascript
// CloudWatch dashboard configuration
const dashboardConfig = {
    DashboardName: 'Chatterbox-Monitoring',
    DashboardBody: JSON.stringify({
        widgets: [
            {
                type: 'metric',
                x: 0,
                y: 0,
                width: 12,
                height: 6,
                properties: {
                    metrics: [
                        ['Chatterbox/Custom', 'EmailsProcessed'],
                        ['Chatterbox/Custom', 'Errors']
                    ],
                    period: 300,
                    stat: 'Sum',
                    region: process.env.AWS_REGION,
                    title: 'Email Processing Metrics'
                }
            },
            {
                type: 'metric',
                x: 12,
                y: 0,
                width: 12,
                height: 6,
                properties: {
                    metrics: [
                        ['Chatterbox/Custom', 'EmailProcessingTime']
                    ],
                    period: 300,
                    stat: 'Average',
                    region: process.env.AWS_REGION,
                    title: 'Email Processing Time'
                }
            }
        ]
    })
};

// Create CloudWatch dashboard
async function createDashboard() {
    try {
        await cloudwatch.putDashboard(dashboardConfig).promise();
        console.log('Created CloudWatch dashboard');
    } catch (error) {
        console.error('Failed to create dashboard:', error);
    }
}
```

## Azure Equivalents (1.a.30.iv)

### 1. Azure Application Insights
```javascript
// Azure Application Insights equivalent
const appInsights = require('applicationinsights');

class AzureLogger {
    constructor(instrumentationKey) {
        appInsights.setup(instrumentationKey);
        this.client = appInsights.defaultClient;
    }
    
    log(level, message, properties = {}) {
        const telemetry = {
            message: message,
            severity: level,
            properties: {
                service: 'chatterbox',
                environment: process.env.ENVIRONMENT || 'development',
                ...properties
            }
        };
        
        switch (level) {
            case 'ERROR':
                this.client.trackException({ exception: new Error(message) });
                break;
            case 'WARN':
                this.client.trackTrace({ message, severity: 2 });
                break;
            case 'INFO':
                this.client.trackTrace({ message, severity: 1 });
                break;
            case 'DEBUG':
                this.client.trackTrace({ message, severity: 0 });
                break;
        }
    }
    
    trackMetric(name, value, properties = {}) {
        this.client.trackMetric({
            name,
            value,
            properties: {
                service: 'chatterbox',
                environment: process.env.ENVIRONMENT || 'development',
                ...properties
            }
        });
    }
    
    trackEvent(name, properties = {}) {
        this.client.trackEvent({
            name,
            properties: {
                service: 'chatterbox',
                environment: process.env.ENVIRONMENT || 'development',
                ...properties
            }
        });
    }
}
```

### 2. Azure Monitor
```javascript
// Azure Monitor equivalent
const azure = require('azure-sdk');

class AzureMonitor {
    constructor(connectionString) {
        this.monitorClient = new azure.MonitorClient(connectionString);
    }
    
    async logMetric(metricName, value, dimensions = {}) {
        const metricData = {
            name: metricName,
            value: value,
            timestamp: new Date(),
            dimensions: {
                service: 'chatterbox',
                environment: process.env.ENVIRONMENT || 'development',
                ...dimensions
            }
        };
        
        try {
            await this.monitorClient.metrics.create(metricData);
        } catch (error) {
            console.error('Failed to log metric to Azure Monitor:', error);
        }
    }
    
    async createAlert(alertName, condition, actionGroup) {
        const alertRule = {
            name: alertName,
            condition: condition,
            actionGroup: actionGroup,
            description: `Alert for ${alertName}`
        };
        
        try {
            await this.monitorClient.alertRules.create(alertRule);
            console.log(`Created Azure alert: ${alertName}`);
        } catch (error) {
            console.error(`Failed to create Azure alert ${alertName}:`, error);
        }
    }
}
```

## Logging Integration Standards

### 1. Lambda Function Integration
```javascript
// Lambda function logging integration
exports.handler = async (event, context) => {
    const logger = new CloudWatchLogger('/aws/lambda/chatterbox-function', context.logStreamName);
    const metrics = new MetricsLogger();
    
    const correlationId = context.awsRequestId;
    
    try {
        logger.info('Lambda function started', {
            correlationId,
            event: JSON.stringify(event),
            functionName: context.functionName,
            functionVersion: context.functionVersion
        });
        
        // Function logic here
        
        logger.info('Lambda function completed successfully', {
            correlationId,
            duration: context.getRemainingTimeInMillis()
        });
        
        metrics.putCustomMetric('LambdaInvocations', 1, {
            functionName: context.functionName,
            status: 'success'
        });
        
        return { statusCode: 200, body: 'Success' };
    } catch (error) {
        logger.error('Lambda function failed', {
            correlationId,
            error: error.message,
            stack: error.stack
        });
        
        metrics.putCustomMetric('LambdaErrors', 1, {
            functionName: context.functionName,
            errorType: error.name
        });
        
        throw error;
    }
};
```

### 2. Application Integration
```javascript
// Application logging integration
class ApplicationLogger {
    constructor() {
        this.cloudwatchLogger = new CloudWatchLogger('/chatterbox/application', this.getLogStreamName());
        this.metrics = new MetricsLogger();
    }
    
    getLogStreamName() {
        const now = new Date();
        return `application/${process.env.INSTANCE_ID || 'local'}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    }
    
    async logOperation(operation, data, metadata = {}) {
        const startTime = Date.now();
        
        try {
            this.cloudwatchLogger.info(`Operation started: ${operation}`, {
                operation,
                data,
                ...metadata
            });
            
            // Operation logic here
            
            const duration = Date.now() - startTime;
            
            this.cloudwatchLogger.info(`Operation completed: ${operation}`, {
                operation,
                duration,
                status: 'success',
                ...metadata
            });
            
            this.metrics.putCustomMetric('Operations', 1, {
                operation,
                status: 'success'
            });
            
            this.metrics.putCustomMetric('OperationDuration', duration, {
                operation
            });
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            this.cloudwatchLogger.error(`Operation failed: ${operation}`, {
                operation,
                error: error.message,
                duration,
                status: 'error',
                ...metadata
            });
            
            this.metrics.putCustomMetric('Operations', 1, {
                operation,
                status: 'error'
            });
            
            throw error;
        }
    }
}
```

This comprehensive approach ensures consistent, reliable, and effective logging across all system components while providing the foundation for monitoring, alerting, and observability. 