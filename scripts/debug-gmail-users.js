const path = require('path');

console.log('=== Debug Gmail Users ===');
console.log('Current working directory:', process.cwd());
console.log('Config path being used:', path.resolve(process.cwd(), 'config.json'));

// Check if config.json exists
const fs = require('fs');
const configPath = path.resolve(process.cwd(), 'config.json');
console.log('Config file exists:', fs.existsSync(configPath));

if (fs.existsSync(configPath)) {
    console.log('Config file contents:');
    const configContent = fs.readFileSync(configPath, 'utf8');
    const configData = JSON.parse(configContent);
    console.log(JSON.stringify(configData.app, null, 2));
}

const config = require('../src/loadConfig.ts').default;

console.log('Config app section:');
console.log(JSON.stringify(config.app, null, 2));

console.log('\nChecking each user:');
console.log(
    `defaultPollGmailUser: "${config.app.defaultPollGmailUser}" (${typeof config.app
        .defaultPollGmailUser})`
);
console.log(
    `defaultSendGmailUser: "${config.app.defaultSendGmailUser}" (${typeof config.app
        .defaultSendGmailUser})`
);
console.log(
    `defaultGetGmailUser: "${config.app.defaultGetGmailUser}" (${typeof config.app
        .defaultGetGmailUser})`
);

console.log('\nTruthy checks:');
console.log(`defaultPollGmailUser truthy: ${!!config.app.defaultPollGmailUser}`);
console.log(`defaultSendGmailUser truthy: ${!!config.app.defaultSendGmailUser}`);
console.log(`defaultGetGmailUser truthy: ${!!config.app.defaultGetGmailUser}`);

// Simulate the logic from authorizeAll.ts
const users = [];
const seenEmails = new Set();

// Add poll Gmail user
if (config.app.defaultPollGmailUser && !seenEmails.has(config.app.defaultPollGmailUser)) {
    console.log('Adding poll user:', config.app.defaultPollGmailUser);
    users.push({
        email: config.app.defaultPollGmailUser,
        purpose: 'Gmail polling (monitoring incoming emails)',
        scopes: config.google.scopes,
    });
    seenEmails.add(config.app.defaultPollGmailUser);
}

// Add send Gmail user
if (config.app.defaultSendGmailUser && !seenEmails.has(config.app.defaultSendGmailUser)) {
    console.log('Adding send user:', config.app.defaultSendGmailUser);
    users.push({
        email: config.app.defaultSendGmailUser,
        purpose: 'Gmail sending (outgoing emails)',
        scopes: config.sendTest.scopes,
    });
    seenEmails.add(config.app.defaultSendGmailUser);
}

// Add get Gmail user
if (config.app.defaultGetGmailUser && !seenEmails.has(config.app.defaultGetGmailUser)) {
    console.log('Adding get user:', config.app.defaultGetGmailUser);
    users.push({
        email: config.app.defaultGetGmailUser,
        purpose: 'Gmail retrieval (reading emails)',
        scopes: config.google.scopes,
    });
    seenEmails.add(config.app.defaultGetGmailUser);
}

console.log('\nFinal users found:', users.length);
users.forEach((user) => {
    console.log(`- ${user.email} (${user.purpose})`);
});
