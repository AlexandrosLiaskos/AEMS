#!/usr/bin/env node

/**
 * Test Runner Script for AEMS
 * Comprehensive test execution with reporting and cleanup
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class TestRunner {
  constructor() {
    this.testResults = {
      unit: { passed: 0, failed: 0, total: 0 },
      integration: { passed: 0, failed: 0, total: 0 },
      coverage: { lines: 0, functions: 0, branches: 0, statements: 0 }
    };
    this.startTime = Date.now();
  }

  async run() {
    console.log('🧪 AEMS Test Suite Runner');
    console.log('=' .repeat(50));
    
    try {
      // Pre-test setup
      await this.preTestSetup();
      
      // Run unit tests
      console.log('\n📋 Running Unit Tests...');
      await this.runUnitTests();
      
      // Run integration tests
      console.log('\n🔗 Running Integration Tests...');
      await this.runIntegrationTests();
      
      // Generate coverage report
      console.log('\n📊 Generating Coverage Report...');
      await this.runCoverageTests();
      
      // Post-test cleanup
      await this.postTestCleanup();
      
      // Display results
      this.displayResults();
      
    } catch (error) {
      console.error('❌ Test runner failed:', error.message);
      process.exit(1);
    }
  }

  async preTestSetup() {
    console.log('🔧 Setting up test environment...');
    
    // Ensure test directories exist
    const testDirs = [
      'tests/unit',
      'tests/integration',
      'tests/setup',
      'tests/test-data',
      'coverage'
    ];

    for (const dir of testDirs) {
      try {
        await fs.access(dir);
      } catch (error) {
        await fs.mkdir(dir, { recursive: true });
      }
    }

    // Backup original data if it exists
    try {
      await fs.access('data');
      await fs.cp('data', 'tests/data-backup', { recursive: true, force: true });
      console.log('✅ Original data backed up');
    } catch (error) {
      console.log('ℹ️  No existing data to backup');
    }

    console.log('✅ Test environment ready');
  }

  async runUnitTests() {
    return new Promise((resolve, reject) => {
      const jest = spawn('npx', ['jest', 'tests/unit', '--verbose', '--json'], {
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      jest.stdout.on('data', (data) => {
        output += data.toString();
        process.stdout.write(data);
      });

      jest.stderr.on('data', (data) => {
        errorOutput += data.toString();
        process.stderr.write(data);
      });

      jest.on('close', (code) => {
        try {
          // Parse Jest JSON output
          const lines = output.split('\n');
          const jsonLine = lines.find(line => line.startsWith('{') && line.includes('testResults'));
          
          if (jsonLine) {
            const results = JSON.parse(jsonLine);
            this.testResults.unit.total = results.numTotalTests || 0;
            this.testResults.unit.passed = results.numPassedTests || 0;
            this.testResults.unit.failed = results.numFailedTests || 0;
          }
        } catch (error) {
          console.warn('⚠️  Could not parse unit test results');
        }

        if (code === 0) {
          console.log('✅ Unit tests completed successfully');
          resolve();
        } else {
          console.log('❌ Unit tests failed');
          resolve(); // Continue with other tests
        }
      });

      jest.on('error', (error) => {
        console.error('❌ Failed to run unit tests:', error.message);
        reject(error);
      });
    });
  }

  async runIntegrationTests() {
    return new Promise((resolve, reject) => {
      const jest = spawn('npx', ['jest', 'tests/integration', '--verbose', '--json'], {
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      jest.stdout.on('data', (data) => {
        output += data.toString();
        process.stdout.write(data);
      });

      jest.stderr.on('data', (data) => {
        errorOutput += data.toString();
        process.stderr.write(data);
      });

      jest.on('close', (code) => {
        try {
          // Parse Jest JSON output
          const lines = output.split('\n');
          const jsonLine = lines.find(line => line.startsWith('{') && line.includes('testResults'));
          
          if (jsonLine) {
            const results = JSON.parse(jsonLine);
            this.testResults.integration.total = results.numTotalTests || 0;
            this.testResults.integration.passed = results.numPassedTests || 0;
            this.testResults.integration.failed = results.numFailedTests || 0;
          }
        } catch (error) {
          console.warn('⚠️  Could not parse integration test results');
        }

        if (code === 0) {
          console.log('✅ Integration tests completed successfully');
          resolve();
        } else {
          console.log('❌ Integration tests failed');
          resolve(); // Continue with coverage
        }
      });

      jest.on('error', (error) => {
        console.error('❌ Failed to run integration tests:', error.message);
        reject(error);
      });
    });
  }

  async runCoverageTests() {
    return new Promise((resolve, reject) => {
      const jest = spawn('npx', ['jest', '--coverage', '--coverageReporters=text', '--coverageReporters=json'], {
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let output = '';

      jest.stdout.on('data', (data) => {
        output += data.toString();
        process.stdout.write(data);
      });

      jest.stderr.on('data', (data) => {
        process.stderr.write(data);
      });

      jest.on('close', async (code) => {
        try {
          // Read coverage report
          const coverageFile = path.join('coverage', 'coverage-final.json');
          const coverageData = await fs.readFile(coverageFile, 'utf8');
          const coverage = JSON.parse(coverageData);
          
          // Calculate overall coverage
          let totalLines = 0, coveredLines = 0;
          let totalFunctions = 0, coveredFunctions = 0;
          let totalBranches = 0, coveredBranches = 0;
          let totalStatements = 0, coveredStatements = 0;

          for (const file in coverage) {
            const fileCoverage = coverage[file];
            totalLines += Object.keys(fileCoverage.l || {}).length;
            coveredLines += Object.values(fileCoverage.l || {}).filter(count => count > 0).length;
            
            totalFunctions += Object.keys(fileCoverage.f || {}).length;
            coveredFunctions += Object.values(fileCoverage.f || {}).filter(count => count > 0).length;
            
            totalBranches += Object.keys(fileCoverage.b || {}).length;
            coveredBranches += Object.values(fileCoverage.b || {}).flat().filter(count => count > 0).length;
            
            totalStatements += Object.keys(fileCoverage.s || {}).length;
            coveredStatements += Object.values(fileCoverage.s || {}).filter(count => count > 0).length;
          }

          this.testResults.coverage = {
            lines: totalLines > 0 ? Math.round((coveredLines / totalLines) * 100) : 0,
            functions: totalFunctions > 0 ? Math.round((coveredFunctions / totalFunctions) * 100) : 0,
            branches: totalBranches > 0 ? Math.round((coveredBranches / totalBranches) * 100) : 0,
            statements: totalStatements > 0 ? Math.round((coveredStatements / totalStatements) * 100) : 0
          };
        } catch (error) {
          console.warn('⚠️  Could not parse coverage report');
        }

        console.log('✅ Coverage report generated');
        resolve();
      });

      jest.on('error', (error) => {
        console.error('❌ Failed to generate coverage:', error.message);
        resolve(); // Continue without coverage
      });
    });
  }

  async postTestCleanup() {
    console.log('🧹 Cleaning up test environment...');
    
    try {
      // Restore original data if backup exists
      await fs.access('tests/data-backup');
      await fs.rm('data', { recursive: true, force: true });
      await fs.cp('tests/data-backup', 'data', { recursive: true });
      await fs.rm('tests/data-backup', { recursive: true, force: true });
      console.log('✅ Original data restored');
    } catch (error) {
      console.log('ℹ️  No data backup to restore');
    }

    // Clean up test artifacts
    try {
      await fs.rm('tests/test-data', { recursive: true, force: true });
      await fs.rm('tests/test-data-backup', { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    console.log('✅ Cleanup completed');
  }

  displayResults() {
    const endTime = Date.now();
    const duration = Math.round((endTime - this.startTime) / 1000);

    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(50));
    
    console.log(`⏱️  Total Duration: ${duration}s`);
    console.log('');
    
    // Unit Tests
    console.log('📋 Unit Tests:');
    console.log(`   Total: ${this.testResults.unit.total}`);
    console.log(`   ✅ Passed: ${this.testResults.unit.passed}`);
    console.log(`   ❌ Failed: ${this.testResults.unit.failed}`);
    
    // Integration Tests
    console.log('\n🔗 Integration Tests:');
    console.log(`   Total: ${this.testResults.integration.total}`);
    console.log(`   ✅ Passed: ${this.testResults.integration.passed}`);
    console.log(`   ❌ Failed: ${this.testResults.integration.failed}`);
    
    // Coverage
    console.log('\n📊 Code Coverage:');
    console.log(`   Lines: ${this.testResults.coverage.lines}%`);
    console.log(`   Functions: ${this.testResults.coverage.functions}%`);
    console.log(`   Branches: ${this.testResults.coverage.branches}%`);
    console.log(`   Statements: ${this.testResults.coverage.statements}%`);
    
    // Overall Status
    const totalTests = this.testResults.unit.total + this.testResults.integration.total;
    const totalPassed = this.testResults.unit.passed + this.testResults.integration.passed;
    const totalFailed = this.testResults.unit.failed + this.testResults.integration.failed;
    
    console.log('\n🎯 Overall:');
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Success Rate: ${totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0}%`);
    
    if (totalFailed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! 🎉');
      process.exit(0);
    } else {
      console.log(`\n⚠️  ${totalFailed} test(s) failed`);
      process.exit(1);
    }
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const runner = new TestRunner();
  runner.run().catch(error => {
    console.error('❌ Test runner crashed:', error);
    process.exit(1);
  });
}

module.exports = TestRunner;
