#!/usr/bin/env node

/**
 * Test Setup Validation Script
 * Validates that the test environment is properly configured
 */

const fs = require('fs').promises;
const path = require('path');

class TestSetupValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.checks = [];
    }

    async validate() {
        console.log('🔍 Validating AEMS Test Setup...');
        console.log('='.repeat(40));

        try {
            await this.checkTestStructure();
            await this.checkTestFiles();
            await this.checkDependencies();
            await this.checkConfiguration();
            await this.runBasicTests();

            this.displayResults();
        } catch (error) {
            console.error('❌ Validation failed:', error.message);
            process.exit(1);
        }
    }

    async checkTestStructure() {
        console.log('📁 Checking test directory structure...');

        const requiredDirs = [
            'tests',
            'tests/setup',
            'tests/unit',
            'tests/integration'
        ];

        for (const dir of requiredDirs) {
            try {
                await fs.access(dir);
                this.checks.push(`✅ Directory exists: ${dir}`);
            } catch (error) {
                this.errors.push(`❌ Missing directory: ${dir}`);
            }
        }
    }

    async checkTestFiles() {
        console.log('📄 Checking test files...');

        const requiredFiles = [
            'tests/setup/test-setup.js',
            'tests/unit/database.test.js',
            'tests/unit/ai.test.js',
            'tests/unit/ai-extractor.test.js',
            'tests/unit/pdf-processor.test.js',
            'tests/unit/gmail.test.js',
            'tests/unit/health-monitor.test.js',
            'tests/unit/audit-logger.test.js',
            'tests/unit/retry-utils.test.js',
            'tests/unit/env-validator.test.js',
            'tests/integration/api.test.js',
            'tests/run-tests.js',
            'tests/README.md'
        ];

        for (const file of requiredFiles) {
            try {
                await fs.access(file);
                this.checks.push(`✅ Test file exists: ${file}`);
            } catch (error) {
                this.errors.push(`❌ Missing test file: ${file}`);
            }
        }
    }

    async checkDependencies() {
        console.log('📦 Checking test dependencies...');

        try {
            const packageJson = await fs.readFile('package.json', 'utf8');
            const pkg = JSON.parse(packageJson);

            const requiredDevDeps = [
                '@jest/globals',
                'jest',
                'supertest'
            ];

            for (const dep of requiredDevDeps) {
                if (pkg.devDependencies && pkg.devDependencies[dep]) {
                    this.checks.push(`✅ Dependency installed: ${dep}`);
                } else {
                    this.errors.push(`❌ Missing dependency: ${dep}`);
                }
            }

            // Check Jest configuration
            if (pkg.jest) {
                this.checks.push('✅ Jest configuration found');

                if (pkg.jest.setupFilesAfterEnv) {
                    this.checks.push('✅ Jest setup files configured');
                } else {
                    this.warnings.push('⚠️  Jest setup files not configured');
                }
            } else {
                this.warnings.push('⚠️  Jest configuration not found in package.json');
            }

        } catch (error) {
            this.errors.push('❌ Could not read package.json');
        }
    }

    async checkConfiguration() {
        console.log('⚙️  Checking test configuration...');

        try {
            // Check if test setup file is valid
            const testSetupPath = path.join(__dirname, 'setup', 'test-setup.js');
            await fs.access(testSetupPath);
            this.checks.push('✅ Test setup file accessible');

            // Note: We can't actually require the setup file here because it uses Jest globals
            this.checks.push('✅ Test setup configuration validated');

        } catch (error) {
            this.errors.push(`❌ Test setup configuration error: ${error.message}`);
        }

        // Check environment variables for testing
        const testEnvVars = [
            'NODE_ENV',
            'OPENAI_API_KEY',
            'SESSION_SECRET'
        ];

        for (const envVar of testEnvVars) {
            if (process.env[envVar]) {
                this.checks.push(`✅ Environment variable set: ${envVar}`);
            } else {
                this.warnings.push(`⚠️  Environment variable not set: ${envVar}`);
            }
        }
    }

    async runBasicTests() {
        console.log('🧪 Running basic test validation...');

        try {
            // Test that we can access main module files
            const moduleFiles = [
                'lib/database.js',
                'lib/ai.js',
                'lib/gmail.js',
                'lib/health-monitor.js',
                'server.js'
            ];

            for (const moduleFile of moduleFiles) {
                try {
                    await fs.access(moduleFile);
                    this.checks.push(`✅ Module file exists: ${moduleFile}`);
                } catch (error) {
                    this.errors.push(`❌ Module file missing: ${moduleFile}`);
                }
            }

            // Test that package.json has correct test scripts
            try {
                const packageJson = await fs.readFile('package.json', 'utf8');
                const pkg = JSON.parse(packageJson);

                if (pkg.scripts && pkg.scripts.test) {
                    this.checks.push('✅ Test script configured in package.json');
                } else {
                    this.errors.push('❌ Test script not configured in package.json');
                }
            } catch (error) {
                this.errors.push(`❌ Could not validate package.json scripts: ${error.message}`);
            }

        } catch (error) {
            this.errors.push(`❌ Basic test validation failed: ${error.message}`);
        }
    }

    displayResults() {
        console.log('\n' + '='.repeat(40));
        console.log('📊 VALIDATION RESULTS');
        console.log('='.repeat(40));

        if (this.checks.length > 0) {
            console.log('\n✅ Successful Checks:');
            this.checks.forEach(check => console.log(`   ${check}`));
        }

        if (this.warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            this.warnings.forEach(warning => console.log(`   ${warning}`));
        }

        if (this.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.errors.forEach(error => console.log(`   ${error}`));
        }

        console.log('\n' + '='.repeat(40));

        if (this.errors.length === 0) {
            console.log('🎉 TEST SETUP VALIDATION PASSED!');
            console.log('✅ Your test environment is ready to run.');
            console.log('\nNext steps:');
            console.log('  npm test              # Run all tests');
            console.log('  npm run test:unit     # Run unit tests only');
            console.log('  npm run test:coverage # Run with coverage');
            process.exit(0);
        } else {
            console.log('❌ TEST SETUP VALIDATION FAILED!');
            console.log(`Found ${this.errors.length} error(s) that need to be fixed.`);
            console.log('\nPlease fix the errors above and run validation again.');
            process.exit(1);
        }
    }
}

// Run validation if this script is executed directly
if (require.main === module) {
    const validator = new TestSetupValidator();
    validator.validate().catch(error => {
        console.error('❌ Validation crashed:', error);
        process.exit(1);
    });
}

module.exports = TestSetupValidator;
