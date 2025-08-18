/**
 * Environment Detection Utility
 * Detects the runtime environment and provides configuration helpers
 */

const path = require('path');

class EnvironmentDetector {
    /**
     * Check if the application is running in Electron
     */
    static isElectron() {
        return process.env.AEMS_MODE === 'desktop' || 
               process.versions && process.versions.electron;
    }

    /**
     * Check if the application is running in CLI mode
     */
    static isCLI() {
        return !this.isElectron();
    }

    /**
     * Get the current runtime mode
     */
    static getMode() {
        return this.isElectron() ? 'desktop' : 'cli';
    }

    /**
     * Get the appropriate data directory for the current environment
     */
    static getDataDirectory() {
        // Check if running in Electron mode
        if (process.env.AEMS_DATA_DIR) {
            return path.join(process.env.AEMS_DATA_DIR, 'aems-data');
        }

        // Check for custom DATA_DIR environment variable
        if (process.env.DATA_DIR) {
            return path.resolve(process.env.DATA_DIR);
        }

        // Default to ./data directory (CLI mode)
        return path.join(__dirname, '../data');
    }

    /**
     * Get the appropriate backup directory for the current environment
     */
    static getBackupDirectory() {
        // If using Electron data directory, put backups in same parent
        if (process.env.AEMS_DATA_DIR) {
            return path.join(process.env.AEMS_DATA_DIR, 'aems-backups');
        }

        // If using custom data directory, put backups alongside
        if (process.env.DATA_DIR) {
            const dataDir = path.resolve(process.env.DATA_DIR);
            return path.join(path.dirname(dataDir), 'backups');
        }

        // Default to ./backups directory (CLI mode)
        return path.join(__dirname, '../backups');
    }

    /**
     * Get environment information for logging
     */
    static getEnvironmentInfo() {
        return {
            mode: this.getMode(),
            isElectron: this.isElectron(),
            isCLI: this.isCLI(),
            dataDirectory: this.getDataDirectory(),
            backupDirectory: this.getBackupDirectory(),
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch
        };
    }

    /**
     * Log environment information
     */
    static logEnvironmentInfo() {
        const info = this.getEnvironmentInfo();
        console.log(`🔧 Runtime Mode: ${info.mode}`);
        console.log(`📁 Data Directory: ${info.dataDirectory}`);
        console.log(`💾 Backup Directory: ${info.backupDirectory}`);
        
        if (info.isElectron) {
            console.log(`⚡ Electron Version: ${process.versions.electron}`);
        }
    }
}

module.exports = EnvironmentDetector;
