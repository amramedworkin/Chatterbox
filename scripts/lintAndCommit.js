// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execSync } = require('child_process');

const message = process.argv.slice(2).join(' ').trim();

if (!message) {
    console.error('❌ Please provide a commit message:\n   npm run lint-commit -- "your message"');
    process.exit(1);
}

try {
    console.log('🔧 Staging all changes...');
    execSync('git add -A', { stdio: 'inherit' });

    console.log(`📦 Creating temporary commit: "${message}"`);
    execSync(`git commit -m "${message}"`, { stdio: 'inherit' });

    console.log('🧹 Reverting commit to keep working directory clean...');
    execSync('git reset --soft HEAD~1', { stdio: 'inherit' });

    console.log('✅ Lint + commit workflow completed. Changes remain staged.');
} catch {
    console.error('❌ Linting or commit process failed.');
    process.exit(1);
}
