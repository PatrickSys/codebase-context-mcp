#!/usr/bin/env node

/**
 * Quick test to verify guard detection is working correctly
 */

import { AngularAnalyzer } from './dist/analyzers/angular/index.js';
import { promises as fs } from 'fs';

const analyzer = new AngularAnalyzer();

async function testGuardDetection() {
  console.log('=== Testing Guard Detection ===\n');

  const authGuardPath = 'C:\\Users\\patrick.colom\\Repos\\SSP_Portal\\libs\\common\\src\\lib\\core\\guards\\auth-guard.service.ts';

  try {
    const content = await fs.readFile(authGuardPath, 'utf-8');

    console.log('File: auth-guard.service.ts');
    console.log('Has @Injectable:', /@Injectable/.test(content) ? 'Yes' : 'No');
    console.log('Has canActivate method:', /canActivate\s*\(/.test(content) ? 'Yes' : 'No');
    console.log('Implements CanActivate:', /implements\s+CanActivate/.test(content) ? 'Yes' : 'No');
    console.log('');

    // Analyze the file
    const result = await analyzer.analyze(authGuardPath, content);

    console.log('Analysis Result:');
    console.log('- Framework:', result.framework);
    console.log('- Components found:', result.components.length);

    if (result.components.length > 0) {
      const component = result.components[0];
      console.log('- Component type:', component.componentType);
      console.log('- Component name:', component.name);

      if (component.componentType === 'guard') {
        console.log('\n✓ SUCCESS: Guard detected correctly!');

        // Test summarization
        if (result.chunks.length > 0) {
          const summary = analyzer.summarize(result.chunks[0]);
          console.log('\nGenerated summary:');
          console.log('  "' + summary + '"');

          if (summary.includes('guard') || summary.includes('Guard')) {
            console.log('\n✓ SUCCESS: Summary mentions "guard"!');
          } else {
            console.log('\n✗ FAIL: Summary does not mention "guard"');
          }
        }
      } else {
        console.log(`\n✗ FAIL: Detected as "${component.componentType}" instead of "guard"`);
      }
    } else {
      console.log('\n✗ FAIL: No components detected');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testGuardDetection();
