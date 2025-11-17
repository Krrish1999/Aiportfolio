import { z } from 'zod';

// File validation schemas
export const fileUploadSchema = z.object({
  name: z.string().min(1, 'File name is required'),
  size: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
  type: z.enum(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'], {
    errorMap: () => ({ message: 'File must be PDF, DOCX, or TXT format' })
  }),
});

// Contact information validation
export const emailSchema = z.string().email('Invalid email format');
export const phoneSchema = z.string().regex(/^[\+]?[1-9][\d\s\-\(\)\.]{7,15}$/, 'Invalid phone number format');
export const urlSchema = z.string().url('Invalid URL format');

// Resume data validation schemas
export const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  title: z.string().min(1, 'Title is required'),
  location: z.string().optional(),
  email: emailSchema,
  phone: phoneSchema.optional(),
  links: z.object({
    github: urlSchema.optional(),
    linkedin: urlSchema.optional(),
    website: urlSchema.optional(),
    portfolio: urlSchema.optional(),
  }).optional(),
});

export const skillCategorySchema = z.object({
  category: z.string().min(1, 'Category name is required'),
  items: z.array(z.string().min(1)).min(1, 'At least one skill is required'),
  confidence: z.number().min(0).max(1, 'Confidence must be between 0 and 1'),
});

export const experienceSchema = z.object({
  company: z.string().min(1, 'Company name is required'),
  role: z.string().min(1, 'Role is required'),
  startDate: z.date(),
  endDate: z.date().optional(),
  bullets: z.array(z.string().min(1)).min(1, 'At least one bullet point is required'),
  techStack: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1, 'Confidence must be between 0 and 1'),
});

export const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().min(1, 'Project description is required'),
  role: z.string().optional(),
  links: z.object({
    repo: urlSchema.optional(),
    demo: urlSchema.optional(),
  }).optional(),
  techStack: z.array(z.string()).default([]),
  screenshots: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1, 'Confidence must be between 0 and 1'),
});

export const educationSchema = z.object({
  degree: z.string().min(1, 'Degree is required'),
  institution: z.string().min(1, 'Institution is required'),
  startDate: z.date(),
  endDate: z.date().optional(),
  gpa: z.string().optional(),
  confidence: z.number().min(0).max(1, 'Confidence must be between 0 and 1'),
});

export const certificationSchema = z.object({
  name: z.string().min(1, 'Certification name is required'),
  issuer: z.string().min(1, 'Issuer is required'),
  date: z.date(),
  url: urlSchema.optional(),
});

export const parsedResumeDataSchema = z.object({
  profile: profileSchema,
  summary: z.string().min(1, 'Summary is required'),
  skills: z.array(skillCategorySchema).min(1, 'At least one skill category is required'),
  experience: z.array(experienceSchema).default([]),
  projects: z.array(projectSchema).default([]),
  education: z.array(educationSchema).default([]),
  certifications: z.array(certificationSchema).optional(),
});

export type ParsedResumeData = z.infer<typeof parsedResumeDataSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type SkillCategory = z.infer<typeof skillCategorySchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Education = z.infer<typeof educationSchema>;
export type Certification = z.infer<typeof certificationSchema>;

// Template validation schemas
export const templateSectionSchema = z.object({
  id: z.string().min(1, 'Section ID is required'),
  name: z.string().min(1, 'Section name is required'),
  type: z.enum(['profile', 'summary', 'skills', 'experience', 'projects', 'education', 'certifications']),
  required: z.boolean(),
  customizable: z.boolean(),
});

export const customizationOptionSchema = z.object({
  id: z.string().min(1, 'Customization ID is required'),
  name: z.string().min(1, 'Customization name is required'),
  type: z.enum(['color', 'font', 'layout', 'spacing']),
  options: z.union([
    z.array(z.string()),
    z.object({
      min: z.number(),
      max: z.number(),
    }),
  ]),
  default: z.union([z.string(), z.number()]),
});

export const templateSchema = z.object({
  id: z.string().min(1, 'Template ID is required'),
  name: z.string().min(1, 'Template name is required'),
  description: z.string().min(1, 'Template description is required'),
  category: z.enum(['minimal', 'modern', 'creative']),
  sections: z.array(templateSectionSchema).min(1, 'At least one section is required'),
  customizations: z.array(customizationOptionSchema),
  previewImage: z.string().url().optional(),
});

// Deployment configuration validation schemas
export const seoConfigSchema = z.object({
  title: z.string().min(1, 'SEO title is required'),
  description: z.string().min(1, 'SEO description is required'),
  keywords: z.array(z.string()).min(1, 'At least one keyword is required'),
  ogImage: z.string().url().optional(),
});

export const deploymentConfigSchema = z.object({
  platform: z.enum(['vercel', 'netlify', 'github-pages']),
  customDomain: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/, 'Invalid domain format').optional(),
  seoConfig: seoConfigSchema,
  analytics: z.object({
    googleAnalytics: z.string().optional(),
    plausible: z.string().optional(),
  }).optional(),
});

export type Template = z.infer<typeof templateSchema>;
export type TemplateSection = z.infer<typeof templateSectionSchema>;
export type CustomizationOption = z.infer<typeof customizationOptionSchema>;
export type DeploymentConfig = z.infer<typeof deploymentConfigSchema>;
export type SEOConfig = z.infer<typeof seoConfigSchema>;

// Validation helper functions
export function validateFile(file: File): { success: boolean; error?: string } {
  try {
    fileUploadSchema.parse({
      name: file.name,
      size: file.size,
      type: file.type,
    });
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: 'File validation failed' };
  }
}

export function validateResumeData(data: unknown): { success: boolean; data?: ParsedResumeData; errors?: string[] } {
  try {
    const validatedData = parsedResumeDataSchema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      return { success: false, errors };
    }
    return { success: false, errors: ['Data validation failed'] };
  }
}

// Enhanced validation functions for specific formats
export function validateEmail(email: string): { isValid: boolean; confidence: number; reason: string } {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(email)) {
    return { isValid: false, confidence: 0, reason: 'Invalid email format' };
  }
  
  // Additional confidence scoring
  let confidence = 0.8; // Base confidence for valid format
  
  // Check for common domains
  const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
  const domain = email.split('@')[1];
  if (commonDomains.includes(domain)) {
    confidence += 0.1;
  }
  
  // Check for professional domains (not free email providers)
  if (!commonDomains.includes(domain) && domain.includes('.')) {
    confidence += 0.1;
  }
  
  return { isValid: true, confidence: Math.min(confidence, 1), reason: 'Valid email format' };
}

export function validatePhone(phone: string): { isValid: boolean; confidence: number; reason: string } {
  // Remove all non-digit characters except + at the start
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  
  // Basic validation patterns
  const patterns = [
    /^\+1[2-9]\d{2}[2-9]\d{2}\d{4}$/, // US format with country code
    /^[2-9]\d{2}[2-9]\d{2}\d{4}$/, // US format without country code
    /^\+\d{1,3}\d{4,14}$/, // International format
    /^\d{10}$/, // Simple 10-digit format
  ];
  
  let confidence = 0;
  let isValid = false;
  let reason = 'Invalid phone format';
  
  for (const pattern of patterns) {
    if (pattern.test(cleanPhone)) {
      isValid = true;
      if (pattern === patterns[0]) {
        confidence = 0.95; // US with country code
        reason = 'Valid US phone with country code';
      } else if (pattern === patterns[1]) {
        confidence = 0.9; // US without country code
        reason = 'Valid US phone format';
      } else if (pattern === patterns[2]) {
        confidence = 0.8; // International
        reason = 'Valid international phone format';
      } else {
        confidence = 0.7; // Basic 10-digit
        reason = 'Valid 10-digit phone format';
      }
      break;
    }
  }
  
  return { isValid, confidence, reason };
}

export function validateURL(url: string): { isValid: boolean; confidence: number; reason: string } {
  try {
    const urlObj = new URL(url);
    let confidence = 0.8; // Base confidence for valid URL
    
    // Check for HTTPS
    if (urlObj.protocol === 'https:') {
      confidence += 0.1;
    }
    
    // Check for common professional domains
    const professionalDomains = ['github.com', 'linkedin.com', 'portfolio', 'dev', 'io'];
    if (professionalDomains.some(domain => urlObj.hostname.includes(domain))) {
      confidence += 0.1;
    }
    
    return { 
      isValid: true, 
      confidence: Math.min(confidence, 1), 
      reason: 'Valid URL format' 
    };
  } catch {
    return { isValid: false, confidence: 0, reason: 'Invalid URL format' };
  }
}

// Template validation functions
export function validateTemplate(template: unknown): { success: boolean; data?: Template; errors?: string[] } {
  try {
    const validatedTemplate = templateSchema.parse(template);
    return { success: true, data: validatedTemplate };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      return { success: false, errors };
    }
    return { success: false, errors: ['Template validation failed'] };
  }
}

// Deployment configuration validation functions
export function validateDeploymentConfig(config: unknown): { success: boolean; data?: DeploymentConfig; errors?: string[] } {
  try {
    const validatedConfig = deploymentConfigSchema.parse(config);
    return { success: true, data: validatedConfig };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      return { success: false, errors };
    }
    return { success: false, errors: ['Deployment configuration validation failed'] };
  }
}

// Domain validation helper
export function validateDomain(domain: string): { isValid: boolean; reason: string } {
  // Check for reserved domains first
  const reservedDomains = ['localhost', 'example.com', 'test.com'];
  if (reservedDomains.includes(domain.toLowerCase())) {
    return { isValid: false, reason: 'Reserved domain name' };
  }
  
  // Simple domain regex - must have at least one dot and valid characters
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;
  
  if (!domainRegex.test(domain)) {
    return { isValid: false, reason: 'Invalid domain format' };
  }
  
  return { isValid: true, reason: 'Valid domain format' };
}