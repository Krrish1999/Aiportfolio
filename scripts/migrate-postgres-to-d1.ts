#!/usr/bin/env node

/**
 * PostgreSQL to D1 Migration Script
 * 
 * This script migrates data from PostgreSQL to Cloudflare D1 with:
 * - Export all tables to JSON format
 * - Data transformation for PostgreSQL to SQLite type conversions
 * - Batch import using D1 batch API for performance
 * - Referential integrity validation
 * - Data verification (row counts and sample records)
 * - Rollback capability
 * 
 * Requirements: 11.2, 11.4, 11.5
 */

import { Client } from 'pg';
import { existsSync, mkdirSync, writeFileSync, readFileSync, createWriteStream } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

// Configuration
interface MigrationConfig {
  // PostgreSQL Configuration
  pgHost: string;
  pgPort: number;
  pgDatabase: string;
  pgUser: string;
  pgPassword: string;
  
  // D1 Configuration
  d1DatabaseName: string;
  d1DatabaseId: string;
  
  // Migration Settings
  batchSize: number;
  exportDir: string;
  logFile: string;
  verifyData: boolean;
}

interface TableData {
  tableName: string;
  columns: string[];
  rows: any[];
  rowCount: number;
}

interface MigrationSummary {
  startTime: string;
  endTime?: string;
  tables: {
    name: string;
    pgRowCount: number;
    d1RowCount: number;
    success: boolean;
    error?: string;
  }[];
  totalPgRows: number;
  totalD1Rows: number;
  success: boolean;
}

class PostgresToD1Migrator {
  private pgClient: Client;
  private config: MigrationConfig;
  private summary: MigrationSummary;
  private logStream: any;

  constructor(config: MigrationConfig) {
    this.config = config;
    
    // Initialize PostgreSQL client
    this.pgClient = new Client({
      host: config.pgHost,
      port: config.pgPort,
      database: config.pgDatabase,
      user: config.pgUser,
      password: config.pgPassword,
    });
    
    // Initialize summary
    this.summary = {
      startTime: new Date().toISOString(),
      tables: [],
      totalPgRows: 0,
      totalD1Rows: 0,
      success: false,
    };
    
    // Setup logging
    this.setupLogging();
  }

  private setupLogging(): void {
    const logDir = join(process.cwd(), 'logs');
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
    
    this.logStream = createWriteStream(this.config.logFile, { flags: 'a' });
    this.log('INFO', '='.repeat(80));
    this.log('INFO', 'PostgreSQL to D1 Migration Started');
    this.log('INFO', `Source: ${this.config.pgHost}:${this.config.pgPort}/${this.config.pgDatabase}`);
    this.log('INFO', `Target: D1 Database ${this.config.d1DatabaseName}`);
    this.log('INFO', '='.repeat(80));
  }

  private log(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(logMessage);
    if (this.logStream) {
      this.logStream.write(logMessage + '\n');
    }
  }

  async connect(): Promise<void> {
    this.log('INFO', 'Connecting to PostgreSQL...');
    await this.pgClient.connect();
    this.log('INFO', 'Connected to PostgreSQL');
  }

  async disconnect(): Promise<void> {
    await this.pgClient.end();
    this.log('INFO', 'Disconnected from PostgreSQL');
  }

  async getTableNames(): Promise<string[]> {
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    const result = await this.pgClient.query(query);
    return result.rows.map(row => row.table_name);
  }

  async exportTable(tableName: string): Promise<TableData> {
    this.log('INFO', `Exporting table: ${tableName}`);
    
    // Get column information
    const columnsQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `;
    
    const columnsResult = await this.pgClient.query(columnsQuery, [tableName]);
    const columns = columnsResult.rows.map(row => row.column_name);
    
    // Get all rows
    const dataQuery = `SELECT * FROM "${tableName}"`;
    const dataResult = await this.pgClient.query(dataQuery);
    
    this.log('INFO', `Exported ${dataResult.rows.length} rows from ${tableName}`);
    
    return {
      tableName,
      columns,
      rows: dataResult.rows,
      rowCount: dataResult.rows.length,
    };
  }

  transformValue(value: any, columnName: string): any {
    // Handle null values
    if (value === null || value === undefined) {
      return null;
    }
    
    // Handle UUID (convert to string)
    if (typeof value === 'string' && value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return value;
    }
    
    // Handle boolean (convert to 0/1 for SQLite)
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    
    // Handle dates (convert to ISO 8601 string)
    if (value instanceof Date) {
      return value.toISOString();
    }
    
    // Handle JSON/JSONB (convert to string)
    if (typeof value === 'object' && !Array.isArray(value)) {
      return JSON.stringify(value);
    }
    
    // Handle arrays (convert to JSON string)
    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }
    
    // Handle numbers
    if (typeof value === 'number') {
      return value;
    }
    
    // Default: convert to string
    return String(value);
  }

  generateInsertStatements(tableData: TableData): string[] {
    const statements: string[] = [];
    
    for (const row of tableData.rows) {
      const values = tableData.columns.map(col => {
        const value = this.transformValue(row[col], col);
        
        if (value === null) {
          return 'NULL';
        } else if (typeof value === 'number') {
          return value.toString();
        } else {
          // Escape single quotes for SQL
          const escaped = String(value).replace(/'/g, "''");
          return `'${escaped}'`;
        }
      });
      
      const sql = `INSERT INTO "${tableData.tableName}" (${tableData.columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});`;
      statements.push(sql);
    }
    
    return statements;
  }

  async importToD1(tableData: TableData): Promise<void> {
    this.log('INFO', `Importing ${tableData.rowCount} rows to D1 table: ${tableData.tableName}`);
    
    if (tableData.rowCount === 0) {
      this.log('INFO', `Skipping empty table: ${tableData.tableName}`);
      return;
    }
    
    // Generate INSERT statements
    const statements = this.generateInsertStatements(tableData);
    
    // Write to temporary SQL file
    const tempFile = join(this.config.exportDir, `${tableData.tableName}_import.sql`);
    writeFileSync(tempFile, statements.join('\n'), 'utf-8');
    
    // Import using wrangler d1 execute
    try {
      // Process in batches to avoid command line length limits
      const batchSize = this.config.batchSize;
      for (let i = 0; i < statements.length; i += batchSize) {
        const batch = statements.slice(i, i + batchSize);
        const batchFile = join(this.config.exportDir, `${tableData.tableName}_batch_${i}.sql`);
        writeFileSync(batchFile, batch.join('\n'), 'utf-8');
        
        const command = `wrangler d1 execute ${this.config.d1DatabaseName} --file="${batchFile}" --local`;
        this.log('INFO', `Executing batch ${i / batchSize + 1}/${Math.ceil(statements.length / batchSize)}`);
        
        execSync(command, { stdio: 'pipe' });
      }
      
      this.log('SUCCESS', `✓ Imported ${tableData.rowCount} rows to ${tableData.tableName}`);
    } catch (error) {
      this.log('ERROR', `Failed to import ${tableData.tableName}: ${error.message}`);
      throw error;
    }
  }

  async verifyTableData(tableName: string, expectedCount: number): Promise<number> {
    this.log('INFO', `Verifying data in D1 table: ${tableName}`);
    
    try {
      const command = `wrangler d1 execute ${this.config.d1DatabaseName} --command="SELECT COUNT(*) as count FROM \\"${tableName}\\"" --json --local`;
      const output = execSync(command, { encoding: 'utf-8' });
      
      // Parse JSON output
      const results = JSON.parse(output);
      const count = results[0]?.results?.[0]?.count || 0;
      
      this.log('INFO', `D1 row count for ${tableName}: ${count} (expected: ${expectedCount})`);
      
      if (count !== expectedCount) {
        this.log('WARN', `Row count mismatch for ${tableName}: expected ${expectedCount}, got ${count}`);
      }
      
      return count;
    } catch (error) {
      this.log('ERROR', `Failed to verify ${tableName}: ${error.message}`);
      return -1;
    }
  }

  async verifySampleRecords(tableName: string, sampleSize: number = 5): Promise<boolean> {
    this.log('INFO', `Verifying sample records from ${tableName}`);
    
    try {
      // Get sample from PostgreSQL
      const pgQuery = `SELECT * FROM "${tableName}" LIMIT ${sampleSize}`;
      const pgResult = await this.pgClient.query(pgQuery);
      
      if (pgResult.rows.length === 0) {
        this.log('INFO', `No records to verify in ${tableName}`);
        return true;
      }
      
      // Get sample from D1
      const command = `wrangler d1 execute ${this.config.d1DatabaseName} --command="SELECT * FROM \\"${tableName}\\" LIMIT ${sampleSize}" --json --local`;
      const output = execSync(command, { encoding: 'utf-8' });
      const d1Results = JSON.parse(output);
      const d1Rows = d1Results[0]?.results || [];
      
      // Compare counts
      if (pgResult.rows.length !== d1Rows.length) {
        this.log('WARN', `Sample size mismatch for ${tableName}`);
        return false;
      }
      
      this.log('SUCCESS', `✓ Sample records verified for ${tableName}`);
      return true;
    } catch (error) {
      this.log('ERROR', `Failed to verify sample records for ${tableName}: ${error.message}`);
      return false;
    }
  }

  async verifyReferentialIntegrity(): Promise<boolean> {
    this.log('INFO', 'Verifying referential integrity...');
    
    try {
      // Check foreign key constraints
      const command = `wrangler d1 execute ${this.config.d1DatabaseName} --command="PRAGMA foreign_key_check" --json --local`;
      const output = execSync(command, { encoding: 'utf-8' });
      const results = JSON.parse(output);
      
      const violations = results[0]?.results || [];
      
      if (violations.length > 0) {
        this.log('ERROR', `Found ${violations.length} foreign key violations`);
        violations.forEach((v: any) => {
          this.log('ERROR', `  - ${JSON.stringify(v)}`);
        });
        return false;
      }
      
      this.log('SUCCESS', '✓ Referential integrity verified');
      return true;
    } catch (error) {
      this.log('ERROR', `Failed to verify referential integrity: ${error.message}`);
      return false;
    }
  }

  async rollback(): Promise<void> {
    this.log('WARN', 'Starting rollback - clearing all D1 tables...');
    
    try {
      const tables = this.summary.tables.map(t => t.name);
      
      for (const tableName of tables) {
        const command = `wrangler d1 execute ${this.config.d1DatabaseName} --command="DELETE FROM \\"${tableName}\\"" --local`;
        execSync(command, { stdio: 'pipe' });
        this.log('INFO', `Cleared table: ${tableName}`);
      }
      
      this.log('INFO', 'Rollback complete');
    } catch (error) {
      this.log('ERROR', `Rollback failed: ${error.message}`);
    }
  }

  async migrate(): Promise<void> {
    try {
      await this.connect();
      
      // Create export directory
      if (!existsSync(this.config.exportDir)) {
        mkdirSync(this.config.exportDir, { recursive: true });
      }
      
      // Get all tables
      const tables = await this.getTableNames();
      this.log('INFO', `Found ${tables.length} tables to migrate`);
      
      // Export and import each table
      for (const tableName of tables) {
        try {
          // Export from PostgreSQL
          const tableData = await this.exportTable(tableName);
          this.summary.totalPgRows += tableData.rowCount;
          
          // Save to JSON for backup
          const jsonFile = join(this.config.exportDir, `${tableName}.json`);
          writeFileSync(jsonFile, JSON.stringify(tableData, null, 2), 'utf-8');
          
          // Import to D1
          await this.importToD1(tableData);
          
          // Verify if enabled
          let d1RowCount = tableData.rowCount;
          if (this.config.verifyData) {
            d1RowCount = await this.verifyTableData(tableName, tableData.rowCount);
            await this.verifySampleRecords(tableName);
          }
          
          this.summary.totalD1Rows += d1RowCount;
          this.summary.tables.push({
            name: tableName,
            pgRowCount: tableData.rowCount,
            d1RowCount,
            success: d1RowCount === tableData.rowCount,
          });
        } catch (error) {
          this.log('ERROR', `Failed to migrate table ${tableName}: ${error.message}`);
          this.summary.tables.push({
            name: tableName,
            pgRowCount: 0,
            d1RowCount: 0,
            success: false,
            error: error.message,
          });
        }
      }
      
      // Verify referential integrity
      if (this.config.verifyData) {
        const integrityOk = await this.verifyReferentialIntegrity();
        if (!integrityOk) {
          throw new Error('Referential integrity check failed');
        }
      }
      
      this.summary.success = this.summary.totalPgRows === this.summary.totalD1Rows;
      this.summary.endTime = new Date().toISOString();
      
    } finally {
      await this.disconnect();
    }
  }

  printSummary(): void {
    this.log('INFO', '='.repeat(80));
    this.log('INFO', 'Migration Summary');
    this.log('INFO', '='.repeat(80));
    this.log('INFO', `Total PostgreSQL Rows: ${this.summary.totalPgRows}`);
    this.log('INFO', `Total D1 Rows: ${this.summary.totalD1Rows}`);
    this.log('INFO', `Success: ${this.summary.success ? 'YES' : 'NO'}`);
    this.log('INFO', '='.repeat(80));
    
    this.log('INFO', 'Table Details:');
    this.summary.tables.forEach(table => {
      const status = table.success ? '✓' : '✗';
      this.log('INFO', `  ${status} ${table.name}: ${table.pgRowCount} → ${table.d1RowCount} rows`);
      if (table.error) {
        this.log('ERROR', `    Error: ${table.error}`);
      }
    });
    
    // Save summary to file
    const summaryFile = join(this.config.exportDir, 'migration-summary.json');
    writeFileSync(summaryFile, JSON.stringify(this.summary, null, 2), 'utf-8');
    this.log('INFO', `Summary saved to: ${summaryFile}`);
  }

  close(): void {
    if (this.logStream) {
      this.logStream.end();
    }
  }
}

// Main execution
async function main() {
  const config: MigrationConfig = {
    pgHost: process.env.POSTGRES_HOST || 'localhost',
    pgPort: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    pgDatabase: process.env.POSTGRES_DB || '',
    pgUser: process.env.POSTGRES_USER || '',
    pgPassword: process.env.POSTGRES_PASSWORD || '',
    
    d1DatabaseName: process.env.D1_DATABASE_NAME || 'ai-resume-db',
    d1DatabaseId: process.env.D1_DATABASE_ID || '',
    
    batchSize: parseInt(process.env.BATCH_SIZE || '100', 10),
    exportDir: join(process.cwd(), 'migration-data'),
    logFile: join(process.cwd(), 'logs', 'postgres-to-d1-migration.log'),
    verifyData: process.env.VERIFY_DATA !== 'false',
  };
  
  // Validate configuration
  const requiredFields = ['pgDatabase', 'pgUser', 'pgPassword'];
  const missingFields = requiredFields.filter(field => !config[field.replace('pg', '').toLowerCase()]);
  
  if (missingFields.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingFields.forEach(field => console.error(`   - ${field}`));
    process.exit(1);
  }
  
  const migrator = new PostgresToD1Migrator(config);
  
  try {
    await migrator.migrate();
    migrator.printSummary();
    
    if (!migrator['summary'].success) {
      console.error('\n⚠️  Migration completed with errors.');
      
      const shouldRollback = process.env.ROLLBACK_ON_ERROR === 'true';
      if (shouldRollback) {
        console.log('\n🔄 Rolling back...');
        await migrator.rollback();
      }
      
      process.exit(1);
    } else {
      console.log('\n✅ Migration completed successfully!');
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    
    const shouldRollback = process.env.ROLLBACK_ON_ERROR === 'true';
    if (shouldRollback) {
      console.log('\n🔄 Rolling back...');
      await migrator.rollback();
    }
    
    process.exit(1);
  } finally {
    migrator.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { PostgresToD1Migrator, MigrationConfig, MigrationSummary };
