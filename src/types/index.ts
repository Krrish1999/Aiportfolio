// Core data model interfaces
export interface ParsedResumeData {
  profile: {
    name: string;
    title: string;
    location?: string;
    email: string;
    phone?: string;
    links: {
      github?: string;
      linkedin?: string;
      website?: string;
      portfolio?: string;
    };
  };
  
  summary: string;
  
  skills: {
    category: string;
    items: string[];
    confidence: number;
  }[];
  
  experience: {
    company: string;
    role: string;
    startDate: Date;
    endDate?: Date;
    bullets: string[];
    techStack: string[];
    confidence: number;
  }[];
  
  projects: {
    name: string;
    description: string;
    role?: string;
    links: {
      repo?: string;
      demo?: string;
    };
    techStack: string[];
    screenshots?: string[];
    confidence: number;
  }[];
  
  education: {
    degree: string;
    institution: string;
    startDate: Date;
    endDate?: Date;
    gpa?: string;
    confidence: number;
  }[];
  
  certifications?: {
    name: string;
    issuer: string;
    date: Date;
    url?: string;
  }[];
}

// Template system interfaces
export interface TemplateSection {
  id: string;
  name: string;
  type: 'profile' | 'summary' | 'skills' | 'experience' | 'projects' | 'education' | 'certifications';
  required: boolean;
  customizable: boolean;
}

export interface CustomizationOption {
  id: string;
  name: string;
  type: 'color' | 'font' | 'layout' | 'spacing';
  options: string[] | { min: number; max: number };
  default: string | number;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: 'minimal' | 'modern' | 'creative';
  sections: TemplateSection[];
  customizations: CustomizationOption[];
  previewImage?: string;
}

// Deployment configuration interfaces are now in src/services/deployment.ts

// Validation and processing interfaces
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  success: boolean;
  errors: ValidationError[];
  data?: ParsedResumeData;
}

export interface ConfidenceScore {
  field: string;
  score: number;
  reason: string;
}

export interface ProcessingMetrics {
  sessionId: string;
  processingTime: number;
  confidenceScores: ConfidenceScore[];
  editsMade: string[];
}

// External integration interfaces
export interface GitHubData {
  username: string;
  repositories: {
    name: string;
    description: string;
    url: string;
    language: string;
    stars: number;
    forks: number;
    topics: string[];
  }[];
  contributionGraph?: string;
}

export interface LinkedInData {
  headline: string;
  summary: string;
  experience: {
    company: string;
    role: string;
    duration: string;
    description: string;
  }[];
  education: {
    school: string;
    degree: string;
    field: string;
    duration: string;
  }[];
}

// File processing interfaces
export interface FileUpload {
  name: string;
  size: number;
  type: string;
  buffer: Buffer;
}

export interface ProcessingStatus {
  status: 'uploading' | 'parsing' | 'enhancing' | 'generating' | 'complete' | 'error';
  progress: number;
  message: string;
  error?: string;
}