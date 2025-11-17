/**
 * Monitored service wrappers
 * 
 * Provides monitoring-enabled versions of core services
 */

import { CloudflareWorkersEnv } from '../config/cloudflare-env';
import { CloudflareMonitor, MonitoredOperations } from './monitoring';
import { FileStorageService } from '../services/file-storage';
import { DatabaseService } from '../services/database';
import { QueueService } from '../services/queue';

/**
 * Create monitored file storage service
 */
export function createMonitoredFileStorage(
  env: CloudflareWorkersEnv,
  monitor: CloudflareMonitor
): FileStorageService {
  const service = new FileStorageService(env);
  const ops = new MonitoredOperations(env, monitor);

  // Wrap methods with monitoring
  const originalUpload = service.uploadFile.bind(service);
  service.uploadFile = async (buffer, name, type, userId) => {
    const start = Date.now();
    try {
      const result = await originalUpload(buffer, name, type, userId);
      monitor.trackR2Operation('put', Date.now() - start, buffer.byteLength, true);
      return result;
    } catch (error) {
      monitor.trackR2Operation(
        'put',
        Date.now() - start,
        buffer.byteLength,
        false,
        (error as Error).message
      );
      throw error;
    }
  };

  const originalDownload = service.downloadFile.bind(service);
  service.downloadFile = async (key) => {
    const start = Date.now();
    try {
      const result = await originalDownload(key);
      monitor.trackR2Operation('get', Date.now() - start, result.byteLength, true);
      return result;
    } catch (error) {
      monitor.trackR2Operation('get', Date.now() - start, 0, false, (error as Error).message);
      throw error;
    }
  };

  return service;
}

/**
 * Create monitored database service
 */
export function createMonitoredDatabase(
  env: CloudflareWorkersEnv,
  monitor: CloudflareMonitor
): DatabaseService {
  const service = new DatabaseService(env);

  // Wrap query methods with monitoring
  const wrapQuery = <T extends (...args: any[]) => Promise<any>>(
    method: T,
    operationName: string
  ): T => {
    return (async (...args: any[]) => {
      const start = Date.now();
      try {
        const result = await method(...args);
        const duration = Date.now() - start;
        const rowCount = Array.isArray(result) ? result.length : 1;
        monitor.trackD1Query(operationName, duration, rowCount, true);
        return result;
      } catch (error) {
        monitor.trackD1Query(
          operationName,
          Date.now() - start,
          0,
          false,
          (error as Error).message
        );
        throw error;
      }
    }) as T;
  };

  // Wrap all database methods
  service.createUser = wrapQuery(service.createUser.bind(service), 'INSERT');
  service.getUser = wrapQuery(service.getUser.bind(service), 'SELECT');
  service.updateUser = wrapQuery(service.updateUser.bind(service), 'UPDATE');
  service.deleteUser = wrapQuery(service.deleteUser.bind(service), 'DELETE');

  service.createResumeSession = wrapQuery(service.createResumeSession.bind(service), 'INSERT');
  service.getResumeSession = wrapQuery(service.getResumeSession.bind(service), 'SELECT');
  service.updateResumeSession = wrapQuery(service.updateResumeSession.bind(service), 'UPDATE');
  service.deleteResumeSession = wrapQuery(service.deleteResumeSession.bind(service), 'DELETE');

  service.createPortfolio = wrapQuery(service.createPortfolio.bind(service), 'INSERT');
  service.getPortfolio = wrapQuery(service.getPortfolio.bind(service), 'SELECT');
  service.updatePortfolio = wrapQuery(service.updatePortfolio.bind(service), 'UPDATE');
  service.deletePortfolio = wrapQuery(service.deletePortfolio.bind(service), 'DELETE');

  return service;
}

/**
 * Create monitored queue service
 */
export function createMonitoredQueue(
  env: CloudflareWorkersEnv,
  monitor: CloudflareMonitor
): QueueService {
  const service = new QueueService(env);

  const originalAddJob = service.addResumeProcessingJob.bind(service);
  service.addResumeProcessingJob = async (jobData) => {
    const start = Date.now();
    try {
      const result = await originalAddJob(jobData);
      monitor.trackWorkerExecution('addJob', Date.now() - start, true);
      return result;
    } catch (error) {
      monitor.trackWorkerExecution(
        'addJob',
        Date.now() - start,
        false,
        (error as Error).message
      );
      throw error;
    }
  };

  const originalGetStatus = service.getJobStatus.bind(service);
  service.getJobStatus = async (jobId) => {
    const start = Date.now();
    try {
      const result = await originalGetStatus(jobId);
      monitor.trackWorkerExecution('getJobStatus', Date.now() - start, true);
      return result;
    } catch (error) {
      monitor.trackWorkerExecution(
        'getJobStatus',
        Date.now() - start,
        false,
        (error as Error).message
      );
      throw error;
    }
  };

  return service;
}

/**
 * Service factory with monitoring
 */
export class MonitoredServiceFactory {
  private monitor: CloudflareMonitor;

  constructor(private env: CloudflareWorkersEnv) {
    this.monitor = new CloudflareMonitor(env);
  }

  getMonitor(): CloudflareMonitor {
    return this.monitor;
  }

  createFileStorage(): FileStorageService {
    return createMonitoredFileStorage(this.env, this.monitor);
  }

  createDatabase(): DatabaseService {
    return createMonitoredDatabase(this.env, this.monitor);
  }

  createQueue(): QueueService {
    return createMonitoredQueue(this.env, this.monitor);
  }

  /**
   * Get monitoring report
   */
  getReport() {
    return this.monitor.generateReport();
  }

  /**
   * Persist metrics to KV
   */
  async persistMetrics() {
    await this.monitor.persistMetrics();
  }

  /**
   * Reset metrics
   */
  reset() {
    this.monitor.reset();
  }
}
