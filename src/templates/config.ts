import { Template, TemplateSection, CustomizationOption } from '../types';

// Define available template sections
export const TEMPLATE_SECTIONS: Record<string, TemplateSection> = {
  profile: {
    id: 'profile',
    name: 'Profile',
    type: 'profile',
    required: true,
    customizable: false,
  },
  summary: {
    id: 'summary',
    name: 'Summary',
    type: 'summary',
    required: false,
    customizable: true,
  },
  skills: {
    id: 'skills',
    name: 'Skills',
    type: 'skills',
    required: false,
    customizable: true,
  },
  experience: {
    id: 'experience',
    name: 'Experience',
    type: 'experience',
    required: false,
    customizable: true,
  },
  projects: {
    id: 'projects',
    name: 'Projects',
    type: 'projects',
    required: false,
    customizable: true,
  },
  education: {
    id: 'education',
    name: 'Education',
    type: 'education',
    required: false,
    customizable: true,
  },
  certifications: {
    id: 'certifications',
    name: 'Certifications',
    type: 'certifications',
    required: false,
    customizable: true,
  },
};

// Define customization options
export const CUSTOMIZATION_OPTIONS: CustomizationOption[] = [
  {
    id: 'primaryColor',
    name: 'Primary Color',
    type: 'color',
    options: ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4'],
    default: '#3B82F6',
  },
  {
    id: 'fontFamily',
    name: 'Font Family',
    type: 'font',
    options: ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Source Sans Pro'],
    default: 'Inter',
  },
  {
    id: 'fontSize',
    name: 'Font Size',
    type: 'layout',
    options: ['small', 'medium', 'large'],
    default: 'medium',
  },
  {
    id: 'spacing',
    name: 'Spacing',
    type: 'spacing',
    options: { min: 1, max: 3 },
    default: 2,
  },
];

// Define available templates
export const TEMPLATES: Template[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean and simple design focusing on content',
    category: 'minimal',
    sections: [
      TEMPLATE_SECTIONS.profile,
      TEMPLATE_SECTIONS.summary,
      TEMPLATE_SECTIONS.experience,
      TEMPLATE_SECTIONS.projects,
      TEMPLATE_SECTIONS.skills,
      TEMPLATE_SECTIONS.education,
      TEMPLATE_SECTIONS.certifications,
    ],
    customizations: CUSTOMIZATION_OPTIONS,
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Contemporary design with bold typography',
    category: 'modern',
    sections: [
      TEMPLATE_SECTIONS.profile,
      TEMPLATE_SECTIONS.summary,
      TEMPLATE_SECTIONS.skills,
      TEMPLATE_SECTIONS.experience,
      TEMPLATE_SECTIONS.projects,
      TEMPLATE_SECTIONS.education,
      TEMPLATE_SECTIONS.certifications,
    ],
    customizations: CUSTOMIZATION_OPTIONS,
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Unique layout with visual emphasis',
    category: 'creative',
    sections: [
      TEMPLATE_SECTIONS.profile,
      TEMPLATE_SECTIONS.projects,
      TEMPLATE_SECTIONS.skills,
      TEMPLATE_SECTIONS.experience,
      TEMPLATE_SECTIONS.education,
      TEMPLATE_SECTIONS.summary,
      TEMPLATE_SECTIONS.certifications,
    ],
    customizations: CUSTOMIZATION_OPTIONS,
  },
];

// Get template by ID
export function getTemplateById(id: string): Template | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

// Get default template
export function getDefaultTemplate(): Template {
  return TEMPLATES[0];
}
