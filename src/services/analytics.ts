/**
 * Analytics and Metrics Collection Service
 * 
 * Tracks:
 * - Parsing confidence scores and accuracy metrics
 * - User edit tracking to identify parsing improvement areas
 * - Time-to-publish and conversion rate measurement
 * - Field-level parsing performance
 */

import { CloudflareWorkersEnv } from '@/config/cloudflare-env';
import { DatabaseService, CreateParsingMetricInput } from './database';
import { ParsedResumeData } from '@/types';

export interface ParsingMetrics {
  sessionId: string;
  fieldMetrics: FieldMetric[];
  overallConfidence: number;
  totalFields: number;
  lowConfidenceFields: number;
}

export interface FieldMetric {
  fieldName: string;
  confidenceScore: number;
  wasEdited: boolean;
  category: 'profile' | 'experience' | 'education' | 'skills' | 'projects' | 'certifications';
}

export interface SessionAnalytics {
  sessionId: string;
  userId: string;
  startTime: string;
  endTime?: string;
  processingDuration?: number;
  editingDuration?: number;
  totalDuration?: number;
  publishTime?: string;
  wasPublished: boolean;
  fileFormat: string;
  parsingAccuracy: number;
  editCount: number;
  lowConfidenceFieldsCount: number;
}

export interface AggregatedMetrics {
  totalSessions: number;
  publishedSessions: number;
  conversionRate: number;
  averageParsingAccuracy: number;
  averageTimeToPublish: number;
  averageEditCount: number;
  mostEditedFields: { fieldName: string; editCount: number; avgConfidence: number }[];
  parsingAccuracyByFormat: { format: string; accuracy: number; count: number }[];
  lowConfidenceFields: { fieldName: string; avgConfidence: number; count: number }[];
}

export interface TimeMetrics {
  sessionId: string;
  uploadTime: string;
  parsingStartTime?: string;
  parsingEndTime?: string;
  firstEditTime?: string;
  lastEditTime?: string;
  publishTime?: string;
  timeToFirstEdit?: number;
  timeToPublish?: number;
  totalEditingTime?: number;
}

/**
 * Analytics Service for tracking parsing and user behavior metrics
 */
export class AnalyticsService {
  private db: DatabaseService;

  constructor(private env: CloudflareWorkersEnv) {
    this.db = new DatabaseService(env);
  }

  /**
   * Track parsing metrics for a resume session
   */
  async trackParsingMetrics(
    sessionId: string,
    parsedData: ParsedResumeData,
    confidenceScores: Record<string, number>
  ): Promise<ParsingMetrics> {
    const fieldMetrics: FieldMetric[] = [];
    let totalConfidence = 0;
    let fieldCount = 0;
    let lowConfidenceCount = 0;

    // Track profile fields
    const profileFields = ['name', 'title', 'email', 'phone', 'location'];
    for (const field of profileFields) {
      const value = parsedData.profile[field as keyof typeof parsedData.profile];
      if (value) {
        const confidence = confidenceScores[`profile.${field}`] || 0.5;
        fieldMetrics.push({
          fieldName: `profile.${field}`,
          confidenceScore: confidence,
          wasEdited: false,
          category: 'profile',
        });
        totalConfidence += confidence;
        fieldCount++;
        if (confidence < 0.7) lowConfidenceCount++;
      }
    }

    // Track links
    if (parsedData.profile.links) {
      for (const [key, value] of Object.entries(parsedData.profile.links)) {
        if (value) {
          const confidence = confidenceScores[`profile.links.${key}`] || 0.5;
          fieldMetrics.push({
            fieldName: `profile.links.${key}`,
            confidenceScore: confidence,
            wasEdited: false,
            category: 'profile',
          });
          totalConfidence += confidence;
          fieldCount++;
          if (confidence < 0.7) lowConfidenceCount++;
        }
      }
    }

    // Track summary
    if (parsedData.summary) {
      const confidence = confidenceScores['summary'] || 0.5;
      fieldMetrics.push({
        fieldName: 'summary',
        confidenceScore: confidence,
        wasEdited: false,
        category: 'profile',
      });
      totalConfidence += confidence;
      fieldCount++;
      if (confidence < 0.7) lowConfidenceCount++;
    }

    // Track experience entries
    parsedData.experience?.forEach((exp, index) => {
      const confidence = exp.confidence || confidenceScores[`experience.${index}`] || 0.5;
      fieldMetrics.push({
        fieldName: `experience.${index}`,
        confidenceScore: confidence,
        wasEdited: false,
        category: 'experience',
      });
      totalConfidence += confidence;
      fieldCount++;
      if (confidence < 0.7) lowConfidenceCount++;
    });

    // Track education entries
    parsedData.education?.forEach((edu, index) => {
      const confidence = edu.confidence || confidenceScores[`education.${index}`] || 0.5;
      fieldMetrics.push({
        fieldName: `education.${index}`,
        confidenceScore: confidence,
        wasEdited: false,
        category: 'education',
      });
      totalConfidence += confidence;
      fieldCount++;
      if (confidence < 0.7) lowConfidenceCount++;
    });

    // Track skills
    parsedData.skills?.forEach((skill, index) => {
      const confidence = skill.confidence || confidenceScores[`skills.${index}`] || 0.5;
      fieldMetrics.push({
        fieldName: `skills.${index}`,
        confidenceScore: confidence,
        wasEdited: false,
        category: 'skills',
      });
      totalConfidence += confidence;
      fieldCount++;
      if (confidence < 0.7) lowConfidenceCount++;
    });

    // Track projects
    parsedData.projects?.forEach((project, index) => {
      const confidence = project.confidence || confidenceScores[`projects.${index}`] || 0.5;
      fieldMetrics.push({
        fieldName: `projects.${index}`,
        confidenceScore: confidence,
        wasEdited: false,
        category: 'projects',
      });
      totalConfidence += confidence;
      fieldCount++;
      if (confidence < 0.7) lowConfidenceCount++;
    });

    // Track certifications
    parsedData.certifications?.forEach((cert, index) => {
      const confidence = confidenceScores[`certifications.${index}`] || 0.5;
      fieldMetrics.push({
        fieldName: `certifications.${index}`,
        confidenceScore: confidence,
        wasEdited: false,
        category: 'certifications',
      });
      totalConfidence += confidence;
      fieldCount++;
      if (confidence < 0.7) lowConfidenceCount++;
    });

    const overallConfidence = fieldCount > 0 ? totalConfidence / fieldCount : 0;

    // Batch insert metrics to database
    const metricsInput: CreateParsingMetricInput[] = fieldMetrics.map((metric) => ({
      sessionId,
      fieldName: metric.fieldName,
      confidenceScore: metric.confidenceScore,
      wasEdited: false,
    }));

    await this.db.batchCreateParsingMetrics(metricsInput);

    return {
      sessionId,
      fieldMetrics,
      overallConfidence,
      totalFields: fieldCount,
      lowConfidenceFields: lowConfidenceCount,
    };
  }

  /**
   * Track user edit on a specific field
   */
  async trackFieldEdit(sessionId: string, fieldName: string): Promise<void> {
    // Get existing metrics for this field
    const metrics = await this.db.getParsingMetricsBySessionId(sessionId);
    const metric = metrics.find((m) => m.field_name === fieldName);

    if (metric) {
      await this.db.updateParsingMetric(metric.id, true);
    } else {
      // Create new metric if it doesn't exist (for dynamically added fields)
      await this.db.createParsingMetric({
        sessionId,
        fieldName,
        confidenceScore: 0.0, // User-added field, no parsing confidence
        wasEdited: true,
      });
    }

    // Store edit timestamp in KV for time tracking
    const editKey = `edit:${sessionId}:${fieldName}`;
    await this.env.RESUME_CACHE.put(editKey, new Date().toISOString(), {
      expirationTtl: 86400 * 7, // Keep for 7 days
    });
  }

  /**
   * Track session timing metrics
   */
  async trackSessionTiming(
    sessionId: string,
    event: 'upload' | 'parsing_start' | 'parsing_end' | 'first_edit' | 'publish'
  ): Promise<void> {
    const key = `timing:${sessionId}:${event}`;
    await this.env.RESUME_CACHE.put(key, new Date().toISOString(), {
      expirationTtl: 86400 * 7, // Keep for 7 days
    });
  }

  /**
   * Get time metrics for a session
   */
  async getSessionTimeMetrics(sessionId: string): Promise<TimeMetrics> {
    const uploadTime = await this.env.RESUME_CACHE.get(`timing:${sessionId}:upload`);
    const parsingStartTime = await this.env.RESUME_CACHE.get(`timing:${sessionId}:parsing_start`);
    const parsingEndTime = await this.env.RESUME_CACHE.get(`timing:${sessionId}:parsing_end`);
    const firstEditTime = await this.env.RESUME_CACHE.get(`timing:${sessionId}:first_edit`);
    const publishTime = await this.env.RESUME_CACHE.get(`timing:${sessionId}:publish`);

    // Get all edit timestamps
    const editKeys = await this.getEditTimestamps(sessionId);
    const lastEditTime = editKeys.length > 0 ? editKeys[editKeys.length - 1] : undefined;

    const metrics: TimeMetrics = {
      sessionId,
      uploadTime: uploadTime || new Date().toISOString(),
      parsingStartTime: parsingStartTime || undefined,
      parsingEndTime: parsingEndTime || undefined,
      firstEditTime: firstEditTime || undefined,
      lastEditTime,
      publishTime: publishTime || undefined,
    };

    // Calculate durations
    if (uploadTime && firstEditTime) {
      metrics.timeToFirstEdit = new Date(firstEditTime).getTime() - new Date(uploadTime).getTime();
    }

    if (uploadTime && publishTime) {
      metrics.timeToPublish = new Date(publishTime).getTime() - new Date(uploadTime).getTime();
    }

    if (firstEditTime && lastEditTime) {
      metrics.totalEditingTime = new Date(lastEditTime).getTime() - new Date(firstEditTime).getTime();
    }

    return metrics;
  }

  /**
   * Get all edit timestamps for a session
   */
  private async getEditTimestamps(sessionId: string): Promise<string[]> {
    const metrics = await this.db.getParsingMetricsBySessionId(sessionId);
    const timestamps: string[] = [];

    for (const metric of metrics) {
      if (this.db.wasMetricEdited(metric)) {
        const editKey = `edit:${sessionId}:${metric.field_name}`;
        const timestamp = await this.env.RESUME_CACHE.get(editKey);
        if (timestamp) {
          timestamps.push(timestamp);
        }
      }
    }

    return timestamps.sort();
  }

  /**
   * Get session analytics
   */
  async getSessionAnalytics(sessionId: string): Promise<SessionAnalytics | null> {
    const session = await this.db.getResumeSession(sessionId);
    if (!session) return null;

    const metrics = await this.db.getParsingMetricsBySessionId(sessionId);
    const timeMetrics = await this.getSessionTimeMetrics(sessionId);
    const portfolio = await this.db.getPortfolioBySessionId(sessionId);

    const editCount = metrics.filter((m) => this.db.wasMetricEdited(m)).length;
    const lowConfidenceCount = metrics.filter((m) => m.confidence_score < 0.7).length;
    const avgConfidence =
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.confidence_score, 0) / metrics.length
        : 0;

    return {
      sessionId,
      userId: session.user_id,
      startTime: session.created_at,
      endTime: timeMetrics.publishTime,
      processingDuration: timeMetrics.parsingEndTime && timeMetrics.parsingStartTime
        ? new Date(timeMetrics.parsingEndTime).getTime() - new Date(timeMetrics.parsingStartTime).getTime()
        : undefined,
      editingDuration: timeMetrics.totalEditingTime,
      totalDuration: timeMetrics.timeToPublish,
      publishTime: timeMetrics.publishTime,
      wasPublished: portfolio ? this.db.isPortfolioPublished(portfolio) : false,
      fileFormat: session.file_format,
      parsingAccuracy: avgConfidence,
      editCount,
      lowConfidenceFieldsCount: lowConfidenceCount,
    };
  }

  /**
   * Get aggregated metrics across all sessions
   */
  async getAggregatedMetrics(
    startDate?: string,
    endDate?: string
  ): Promise<AggregatedMetrics> {
    // Get all sessions in date range
    const sessions = await this.getAllSessionsInRange(startDate, endDate);
    
    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        publishedSessions: 0,
        conversionRate: 0,
        averageParsingAccuracy: 0,
        averageTimeToPublish: 0,
        averageEditCount: 0,
        mostEditedFields: [],
        parsingAccuracyByFormat: [],
        lowConfidenceFields: [],
      };
    }

    const sessionAnalytics = await Promise.all(
      sessions.map((s) => this.getSessionAnalytics(s.id as string))
    );

    const validAnalytics = sessionAnalytics.filter((a): a is SessionAnalytics => a !== null);

    const totalSessions = validAnalytics.length;
    const publishedSessions = validAnalytics.filter((a) => a.wasPublished).length;
    const conversionRate = totalSessions > 0 ? (publishedSessions / totalSessions) * 100 : 0;

    const avgAccuracy =
      validAnalytics.reduce((sum, a) => sum + a.parsingAccuracy, 0) / totalSessions;

    const publishedAnalytics = validAnalytics.filter((a) => a.totalDuration);
    const avgTimeToPublish =
      publishedAnalytics.length > 0
        ? publishedAnalytics.reduce((sum, a) => sum + (a.totalDuration || 0), 0) /
          publishedAnalytics.length
        : 0;

    const avgEditCount =
      validAnalytics.reduce((sum, a) => sum + a.editCount, 0) / totalSessions;

    // Calculate most edited fields
    const fieldEditCounts = new Map<string, { count: number; totalConfidence: number; samples: number }>();
    
    for (const session of sessions) {
      const metrics = await this.db.getParsingMetricsBySessionId(session.id as string);
      for (const metric of metrics) {
        if (this.db.wasMetricEdited(metric)) {
          const existing = fieldEditCounts.get(metric.field_name) || {
            count: 0,
            totalConfidence: 0,
            samples: 0,
          };
          fieldEditCounts.set(metric.field_name, {
            count: existing.count + 1,
            totalConfidence: existing.totalConfidence + metric.confidence_score,
            samples: existing.samples + 1,
          });
        }
      }
    }

    const mostEditedFields = Array.from(fieldEditCounts.entries())
      .map(([fieldName, data]) => ({
        fieldName,
        editCount: data.count,
        avgConfidence: data.samples > 0 ? data.totalConfidence / data.samples : 0,
      }))
      .sort((a, b) => b.editCount - a.editCount)
      .slice(0, 10);

    // Calculate accuracy by format
    const formatStats = new Map<string, { totalAccuracy: number; count: number }>();
    for (const analytics of validAnalytics) {
      const existing = formatStats.get(analytics.fileFormat) || { totalAccuracy: 0, count: 0 };
      formatStats.set(analytics.fileFormat, {
        totalAccuracy: existing.totalAccuracy + analytics.parsingAccuracy,
        count: existing.count + 1,
      });
    }

    const parsingAccuracyByFormat = Array.from(formatStats.entries()).map(
      ([format, data]) => ({
        format,
        accuracy: data.count > 0 ? data.totalAccuracy / data.count : 0,
        count: data.count,
      })
    );

    // Calculate low confidence fields
    const lowConfidenceStats = new Map<string, { totalConfidence: number; count: number }>();
    
    for (const session of sessions) {
      const metrics = await this.db.getParsingMetricsBySessionId(session.id as string);
      for (const metric of metrics) {
        if (metric.confidence_score < 0.7) {
          const existing = lowConfidenceStats.get(metric.field_name) || {
            totalConfidence: 0,
            count: 0,
          };
          lowConfidenceStats.set(metric.field_name, {
            totalConfidence: existing.totalConfidence + metric.confidence_score,
            count: existing.count + 1,
          });
        }
      }
    }

    const lowConfidenceFields = Array.from(lowConfidenceStats.entries())
      .map(([fieldName, data]) => ({
        fieldName,
        avgConfidence: data.count > 0 ? data.totalConfidence / data.count : 0,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalSessions,
      publishedSessions,
      conversionRate,
      averageParsingAccuracy: avgAccuracy,
      averageTimeToPublish: avgTimeToPublish,
      averageEditCount: avgEditCount,
      mostEditedFields,
      parsingAccuracyByFormat,
      lowConfidenceFields,
    };
  }

  /**
   * Get all sessions in a date range
   */
  private async getAllSessionsInRange(startDate?: string, endDate?: string) {
    // Note: This is a simplified version. In production, you'd want to add date filtering to the SQL query
    const result = await this.env.DB.prepare(
      'SELECT * FROM resume_sessions ORDER BY created_at DESC LIMIT 1000'
    ).all();

    let sessions = result.results || [];

    if (startDate) {
      sessions = sessions.filter((s: any) => s.created_at >= startDate);
    }

    if (endDate) {
      sessions = sessions.filter((s: any) => s.created_at <= endDate);
    }

    return sessions;
  }

  /**
   * Export metrics to JSON for analysis
   */
  async exportMetrics(sessionId: string): Promise<string> {
    const analytics = await this.getSessionAnalytics(sessionId);
    const metrics = await this.db.getParsingMetricsBySessionId(sessionId);
    const timeMetrics = await this.getSessionTimeMetrics(sessionId);

    return JSON.stringify(
      {
        analytics,
        metrics: metrics.map((m) => ({
          fieldName: m.field_name,
          confidenceScore: m.confidence_score,
          wasEdited: this.db.wasMetricEdited(m),
          createdAt: m.created_at,
        })),
        timeMetrics,
      },
      null,
      2
    );
  }

  /**
   * Store aggregated metrics snapshot in KV for historical tracking
   */
  async snapshotMetrics(date: string): Promise<void> {
    const metrics = await this.getAggregatedMetrics(date, date);
    const key = `metrics:snapshot:${date}`;
    
    await this.env.RESUME_CACHE.put(key, JSON.stringify(metrics), {
      expirationTtl: 86400 * 365, // Keep for 1 year
    });
  }

  /**
   * Get historical metrics snapshot
   */
  async getHistoricalSnapshot(date: string): Promise<AggregatedMetrics | null> {
    const key = `metrics:snapshot:${date}`;
    const data = await this.env.RESUME_CACHE.get(key);
    
    return data ? JSON.parse(data) : null;
  }
}
