/**
 * Example usage of the bio enhancement functionality
 * This demonstrates how the AI content generator creates tech-focused bio summaries
 * with role-specific prompt variations.
 */

import { aiContentGenerator, DeveloperRole } from '../ai-content-generator';
import { ParsedResumeData } from '../../types';

// Example usage function (for demonstration purposes)
export async function demonstrateBioEnhancement() {
  // Sample experience data
  const sampleExperience: ParsedResumeData['experience'] = [
    {
      company: 'TechCorp Inc',
      role: 'Senior Frontend Developer',
      startDate: new Date('2020-01-01'),
      endDate: new Date('2023-12-01'),
      bullets: [
        'Built responsive web applications using React and TypeScript',
        'Improved application performance by 40%',
        'Led a team of 3 junior developers'
      ],
      techStack: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'GraphQL'],
      confidence: 0.9
    },
    {
      company: 'StartupXYZ',
      role: 'Full Stack Developer',
      startDate: new Date('2018-06-01'),
      endDate: new Date('2020-01-01'),
      bullets: [
        'Developed full-stack applications using Node.js and React',
        'Implemented RESTful APIs with PostgreSQL database',
        'Deployed applications on AWS using Docker'
      ],
      techStack: ['Node.js', 'React', 'PostgreSQL', 'AWS', 'Docker'],
      confidence: 0.8
    }
  ];

  // Example bio enhancement for different roles
  const roles: DeveloperRole[] = ['frontend', 'backend', 'full-stack', 'ml'];
  
  console.log('Bio Enhancement Examples:');
  console.log('========================\n');

  for (const role of roles) {
    console.log(`${role.toUpperCase()} DEVELOPER:`);
    console.log('Original bio: "I am a software developer with experience in web development."');
    
    try {
      // Note: This would require a valid OpenAI API key in a real environment
      const enhancedBio = await aiContentGenerator.enhanceBio(
        'I am a software developer with experience in web development.',
        sampleExperience,
        role
      );
      
      console.log(`Enhanced bio: "${enhancedBio}"`);
    } catch (error) {
      console.log('Enhanced bio: [Would be generated with valid OpenAI API key]');
      console.log(`Expected focus: ${getRoleFocus(role)}`);
    }
    
    console.log('---\n');
  }
}

function getRoleFocus(role: DeveloperRole): string {
  const focuses = {
    'frontend': 'UI/UX development, React, TypeScript, responsive design',
    'backend': 'Server-side development, APIs, databases, system architecture',
    'full-stack': 'End-to-end development, versatility across tech stack',
    'ml': 'Machine learning, data science, AI model development',
    'devops': 'Infrastructure, CI/CD, cloud platforms, automation',
    'mobile': 'Mobile app development, cross-platform solutions',
    'general': 'Overall software development expertise'
  };
  
  return focuses[role] || focuses['general'];
}

// Export for potential use in integration tests
export { sampleExperience };