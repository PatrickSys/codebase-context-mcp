/**
 * Angular Analyzer - Comprehensive Angular-specific code analysis
 * Understands components, services, directives, pipes, modules, guards, interceptors, etc.
 * Detects state management patterns, architectural layers, and Angular-specific patterns
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  FrameworkAnalyzer,
  AnalysisResult,
  CodebaseMetadata,
  CodeChunk,
  CodeComponent,
  ImportStatement,
  ExportStatement,
  Dependency,
  FrameworkInfo,
  ArchitecturalLayer,
} from '../../types/index.js';
import { parse } from '@typescript-eslint/typescript-estree';
import { createChunksFromCode } from '../../utils/chunking.js';

export class AngularAnalyzer implements FrameworkAnalyzer {
  readonly name = 'angular';
  readonly version = '1.0.0';
  readonly supportedExtensions = ['.ts', '.js', '.html', '.scss', '.css', '.sass', '.less'];
  readonly priority = 100; // Highest priority for Angular files

  private angularPatterns = {
    component: /@Component\s*\(/,
    service: /@Injectable\s*\(/,
    directive: /@Directive\s*\(/,
    pipe: /@Pipe\s*\(/,
    module: /@NgModule\s*\(/,
    // Guards: Check for interface implementation OR method signature
    guard: /(?:implements\s+(?:CanActivate|CanDeactivate|CanLoad|CanMatch)|canActivate\s*\(|canDeactivate\s*\(|canLoad\s*\(|canMatch\s*\()/,
    interceptor: /(?:implements\s+HttpInterceptor|intercept\s*\()/,
    resolver: /(?:implements\s+Resolve|resolve\s*\()/,
    validator: /(?:implements\s+(?:Validator|AsyncValidator)|validate\s*\()/,
  };

  private stateManagementPatterns = {
    ngrx: /@ngrx\/store|createAction|createReducer|createSelector/,
    akita: /@datorama\/akita|Query|Store\.update/,
    elf: /@ngneat\/elf|createStore|withEntities/,
    signals: /signal\(|computed\(|effect\(/,
    rxjsState: /BehaviorSubject|ReplaySubject|shareReplay/,
  };

  canAnalyze(filePath: string, content?: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    if (!this.supportedExtensions.includes(ext)) {
      return false;
    }

    // For TypeScript files, check if it contains Angular decorators
    if (ext === '.ts' && content) {
      return Object.values(this.angularPatterns).some(pattern => pattern.test(content));
    }

    // Angular component templates and styles
    if (['.html', '.scss', '.css', '.sass', '.less'].includes(ext)) {
      // Check if there's a corresponding .ts file
      const baseName = filePath.replace(/\.(html|scss|css|sass|less)$/, '');
      return true; // We'll verify during analysis
    }

    return false;
  }

  async analyze(filePath: string, content: string): Promise<AnalysisResult> {
    const ext = path.extname(filePath).toLowerCase();
    const relativePath = path.relative(process.cwd(), filePath);

    if (ext === '.ts') {
      return this.analyzeTypeScriptFile(filePath, content, relativePath);
    } else if (ext === '.html') {
      return this.analyzeTemplateFile(filePath, content, relativePath);
    } else if (['.scss', '.css', '.sass', '.less'].includes(ext)) {
      return this.analyzeStyleFile(filePath, content, relativePath);
    }

    // Fallback
    return {
      filePath,
      language: 'unknown',
      framework: 'angular',
      components: [],
      imports: [],
      exports: [],
      dependencies: [],
      metadata: {},
      chunks: [],
    };
  }

  private async analyzeTypeScriptFile(
    filePath: string,
    content: string,
    relativePath: string
  ): Promise<AnalysisResult> {
    const components: CodeComponent[] = [];
    const imports: ImportStatement[] = [];
    const exports: ExportStatement[] = [];
    const dependencies: string[] = [];

    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        comment: true,
      });

      // Extract imports
      for (const node of ast.body) {
        if (node.type === 'ImportDeclaration' && node.source.value) {
          const source = node.source.value as string;
          imports.push({
            source,
            imports: node.specifiers.map((s: any) => {
              if (s.type === 'ImportDefaultSpecifier') return 'default';
              if (s.type === 'ImportNamespaceSpecifier') return '*';
              return s.imported?.name || s.local.name;
            }),
            isDefault: node.specifiers.some((s: any) => s.type === 'ImportDefaultSpecifier'),
            isDynamic: false,
          });

          // Track dependencies
          if (!source.startsWith('.') && !source.startsWith('/')) {
            dependencies.push(source.split('/')[0]);
          }
        }

        // Extract class declarations with decorators
        if (node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'ClassDeclaration') {
          const classNode = node.declaration;
          if (classNode.id && classNode.decorators) {
            const component = await this.extractAngularComponent(classNode, content);
            if (component) {
              components.push(component);
            }
          }
        }

        // Handle direct class exports
        if (node.type === 'ClassDeclaration' && node.id && node.decorators) {
          const component = await this.extractAngularComponent(node, content);
          if (component) {
            components.push(component);
          }
        }

        // Extract exports
        if (node.type === 'ExportNamedDeclaration') {
          if (node.declaration) {
            if (node.declaration.type === 'ClassDeclaration' && node.declaration.id) {
              exports.push({
                name: node.declaration.id.name,
                isDefault: false,
                type: 'class',
              });
            }
          }
        }

        if (node.type === 'ExportDefaultDeclaration') {
          const name = node.declaration.type === 'Identifier' 
            ? node.declaration.name 
            : 'default';
          exports.push({
            name,
            isDefault: true,
            type: 'default',
          });
        }
      }
    } catch (error) {
      console.warn(`Failed to parse Angular TypeScript file ${filePath}:`, error);
    }

    // Detect state management
    const statePattern = this.detectStateManagement(content);

    // Determine architectural layer
    const layer = this.determineLayer(filePath, components);

    // Create chunks with Angular-specific metadata
    const chunks = await createChunksFromCode(
      content,
      filePath,
      relativePath,
      'typescript',
      components,
      {
        framework: 'angular',
        layer,
        statePattern,
        dependencies,
      }
    );

    return {
      filePath,
      language: 'typescript',
      framework: 'angular',
      components,
      imports,
      exports,
      dependencies: dependencies.map(name => ({
        name,
        category: this.categorizeDependency(name),
        layer,
      })),
      metadata: {
        analyzer: this.name,
        layer,
        statePattern,
        isStandalone: content.includes('standalone: true'),
        hasRoutes: content.includes('RouterModule') || content.includes('routes'),
      },
      chunks,
    };
  }

  private async extractAngularComponent(classNode: any, content: string): Promise<CodeComponent | null> {
    if (!classNode.decorators || classNode.decorators.length === 0) {
      return null;
    }

    const decorator = classNode.decorators[0];
    const decoratorName = decorator.expression.callee?.name || decorator.expression.name;

    let componentType: string | undefined;
    let angularType: string | undefined;

    // Determine Angular component type
    if (decoratorName === 'Component') {
      componentType = 'component';
      angularType = 'component';
    } else if (decoratorName === 'Directive') {
      componentType = 'directive';
      angularType = 'directive';
    } else if (decoratorName === 'Pipe') {
      componentType = 'pipe';
      angularType = 'pipe';
    } else if (decoratorName === 'NgModule') {
      componentType = 'module';
      angularType = 'module';
    } else if (decoratorName === 'Injectable') {
      // For @Injectable, check if it's actually a guard/interceptor/resolver/validator
      // before defaulting to 'service'
      const classContent = content.substring(classNode.range[0], classNode.range[1]);

      if (this.angularPatterns.guard.test(classContent)) {
        componentType = 'guard';
        angularType = 'guard';
      } else if (this.angularPatterns.interceptor.test(classContent)) {
        componentType = 'interceptor';
        angularType = 'interceptor';
      } else if (this.angularPatterns.resolver.test(classContent)) {
        componentType = 'resolver';
        angularType = 'resolver';
      } else if (this.angularPatterns.validator.test(classContent)) {
        componentType = 'validator';
        angularType = 'validator';
      } else {
        // Default to service if no specific pattern matches
        componentType = 'service';
        angularType = 'service';
      }
    }

    // If still no type, check patterns one more time (for classes without decorators)
    if (!componentType) {
      const classContent = content.substring(classNode.range[0], classNode.range[1]);

      if (this.angularPatterns.guard.test(classContent)) {
        componentType = 'guard';
        angularType = 'guard';
      } else if (this.angularPatterns.interceptor.test(classContent)) {
        componentType = 'interceptor';
        angularType = 'interceptor';
      } else if (this.angularPatterns.resolver.test(classContent)) {
        componentType = 'resolver';
        angularType = 'resolver';
      } else if (this.angularPatterns.validator.test(classContent)) {
        componentType = 'validator';
        angularType = 'validator';
      }
    }

    // Extract decorator metadata
    const decoratorMetadata = this.extractDecoratorMetadata(decorator);

    // Extract lifecycle hooks
    const lifecycle = this.extractLifecycleHooks(classNode);

    // Extract injected dependencies
    const injectedServices = this.extractInjectedServices(classNode);

    // Extract inputs and outputs
    const inputs = this.extractInputs(classNode);
    const outputs = this.extractOutputs(classNode);

    return {
      name: classNode.id.name,
      type: 'class',
      componentType,
      startLine: classNode.loc.start.line,
      endLine: classNode.loc.end.line,
      decorators: [{
        name: decoratorName,
        properties: decoratorMetadata,
      }],
      lifecycle,
      dependencies: injectedServices,
      properties: [...inputs, ...outputs],
      metadata: {
        angularType,
        selector: decoratorMetadata.selector,
        isStandalone: decoratorMetadata.standalone === true,
        template: decoratorMetadata.template,
        templateUrl: decoratorMetadata.templateUrl,
        styleUrls: decoratorMetadata.styleUrls,
        inputs: inputs.map(i => i.name),
        outputs: outputs.map(o => o.name),
      },
    };
  }

  private extractDecoratorMetadata(decorator: any): Record<string, any> {
    const metadata: Record<string, any> = {};

    try {
      if (decorator.expression.arguments && decorator.expression.arguments[0]) {
        const arg = decorator.expression.arguments[0];
        
        if (arg.type === 'ObjectExpression') {
          for (const prop of arg.properties) {
            if (prop.key && prop.value) {
              const key = prop.key.name || prop.key.value;
              
              if (prop.value.type === 'Literal') {
                metadata[key] = prop.value.value;
              } else if (prop.value.type === 'ArrayExpression') {
                metadata[key] = prop.value.elements.map((el: any) => 
                  el.type === 'Literal' ? el.value : null
                ).filter(Boolean);
              } else if (prop.value.type === 'Identifier') {
                metadata[key] = prop.value.name;
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to extract decorator metadata:', error);
    }

    return metadata;
  }

  private extractLifecycleHooks(classNode: any): string[] {
    const hooks: string[] = [];
    const lifecycleHooks = [
      'ngOnChanges',
      'ngOnInit',
      'ngDoCheck',
      'ngAfterContentInit',
      'ngAfterContentChecked',
      'ngAfterViewInit',
      'ngAfterViewChecked',
      'ngOnDestroy',
    ];

    if (classNode.body && classNode.body.body) {
      for (const member of classNode.body.body) {
        if (member.type === 'MethodDefinition' && member.key) {
          const methodName = member.key.name;
          if (lifecycleHooks.includes(methodName)) {
            hooks.push(methodName);
          }
        }
      }
    }

    return hooks;
  }

  private extractInjectedServices(classNode: any): string[] {
    const services: string[] = [];

    // Look for constructor parameters
    if (classNode.body && classNode.body.body) {
      for (const member of classNode.body.body) {
        if (member.type === 'MethodDefinition' && member.kind === 'constructor') {
          if (member.value.params) {
            for (const param of member.value.params) {
              if (param.typeAnnotation?.typeAnnotation?.typeName) {
                services.push(param.typeAnnotation.typeAnnotation.typeName.name);
              }
            }
          }
        }
      }
    }

    return services;
  }

  private extractInputs(classNode: any): any[] {
    const inputs: any[] = [];

    if (classNode.body && classNode.body.body) {
      for (const member of classNode.body.body) {
        if (member.type === 'PropertyDefinition' && member.decorators) {
          const hasInput = member.decorators.some((d: any) => 
            d.expression?.callee?.name === 'Input' || d.expression?.name === 'Input'
          );

          if (hasInput && member.key) {
            inputs.push({
              name: member.key.name,
              type: member.typeAnnotation?.typeAnnotation?.type || 'any',
            });
          }
        }
      }
    }

    return inputs;
  }

  private extractOutputs(classNode: any): any[] {
    const outputs: any[] = [];

    if (classNode.body && classNode.body.body) {
      for (const member of classNode.body.body) {
        if (member.type === 'PropertyDefinition' && member.decorators) {
          const hasOutput = member.decorators.some((d: any) => 
            d.expression?.callee?.name === 'Output' || d.expression?.name === 'Output'
          );

          if (hasOutput && member.key) {
            outputs.push({
              name: member.key.name,
              type: 'EventEmitter',
            });
          }
        }
      }
    }

    return outputs;
  }

  private async analyzeTemplateFile(
    filePath: string,
    content: string,
    relativePath: string
  ): Promise<AnalysisResult> {
    // Find corresponding component file
    const componentPath = filePath.replace(/\.html$/, '.ts');

    return {
      filePath,
      language: 'html',
      framework: 'angular',
      components: [],
      imports: [],
      exports: [],
      dependencies: [],
      metadata: {
        analyzer: this.name,
        type: 'template',
        componentPath,
        hasDirectives: /\*ng(?:If|For|Switch)/.test(content),
        hasBindings: /\[|\(|{{/.test(content),
      },
      chunks: await createChunksFromCode(content, filePath, relativePath, 'html', []),
    };
  }

  private async analyzeStyleFile(
    filePath: string,
    content: string,
    relativePath: string
  ): Promise<AnalysisResult> {
    const ext = path.extname(filePath).toLowerCase();
    const language = ext.substring(1); // Remove the dot

    return {
      filePath,
      language,
      framework: 'angular',
      components: [],
      imports: [],
      exports: [],
      dependencies: [],
      metadata: {
        analyzer: this.name,
        type: 'style',
      },
      chunks: await createChunksFromCode(content, filePath, relativePath, language, []),
    };
  }

  private detectStateManagement(content: string): string | undefined {
    for (const [pattern, regex] of Object.entries(this.stateManagementPatterns)) {
      if (regex.test(content)) {
        return pattern;
      }
    }
    return undefined;
  }

  private determineLayer(filePath: string, components: CodeComponent[]): ArchitecturalLayer {
    const lowerPath = filePath.toLowerCase();

    // Check path-based patterns
    if (lowerPath.includes('/component') || lowerPath.includes('/view') || lowerPath.includes('/page')) {
      return 'presentation';
    }
    if (lowerPath.includes('/service')) {
      return 'business';
    }
    if (lowerPath.includes('/data') || lowerPath.includes('/repository') || lowerPath.includes('/api')) {
      return 'data';
    }
    if (lowerPath.includes('/store') || lowerPath.includes('/state') || lowerPath.includes('/ngrx')) {
      return 'state';
    }
    if (lowerPath.includes('/core')) {
      return 'core';
    }
    if (lowerPath.includes('/shared')) {
      return 'shared';
    }
    if (lowerPath.includes('/feature')) {
      return 'feature';
    }

    // Check component types
    for (const component of components) {
      if (component.componentType === 'component' || component.componentType === 'directive' || component.componentType === 'pipe') {
        return 'presentation';
      }
      if (component.componentType === 'service') {
        return lowerPath.includes('http') || lowerPath.includes('api') ? 'data' : 'business';
      }
      if (component.componentType === 'guard' || component.componentType === 'interceptor') {
        return 'core';
      }
    }

    return 'unknown';
  }

  private categorizeDependency(name: string): any {
    if (name.startsWith('@angular/')) {
      return 'framework';
    }
    if (name.includes('ngrx') || name.includes('akita') || name.includes('elf')) {
      return 'state';
    }
    if (name.includes('material') || name.includes('primeng') || name.includes('ng-bootstrap')) {
      return 'ui';
    }
    if (name.includes('router')) {
      return 'routing';
    }
    if (name.includes('http') || name.includes('common/http')) {
      return 'http';
    }
    if (name.includes('test') || name.includes('jest') || name.includes('jasmine') || name.includes('karma')) {
      return 'testing';
    }
    return 'other';
  }

  async detectCodebaseMetadata(rootPath: string): Promise<CodebaseMetadata> {
    const metadata: CodebaseMetadata = {
      name: path.basename(rootPath),
      rootPath,
      languages: [],
      dependencies: [],
      architecture: {
        type: 'feature-based',
        layers: {
          presentation: 0,
          business: 0,
          data: 0,
          state: 0,
          core: 0,
          shared: 0,
          feature: 0,
          infrastructure: 0,
          unknown: 0,
        },
        patterns: [],
      },
      styleGuides: [],
      documentation: [],
      projectStructure: {
        type: 'single-app',
      },
      statistics: {
        totalFiles: 0,
        totalLines: 0,
        totalComponents: 0,
        componentsByType: {},
        componentsByLayer: {
          presentation: 0,
          business: 0,
          data: 0,
          state: 0,
          core: 0,
          shared: 0,
          feature: 0,
          infrastructure: 0,
          unknown: 0,
        },
      },
      customMetadata: {},
    };

    try {
      // Read package.json
      const packageJsonPath = path.join(rootPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      metadata.name = packageJson.name || metadata.name;

      // Extract Angular version and dependencies
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      const angularVersion = allDeps['@angular/core']?.replace(/[\^~]/, '') || 'unknown';

      // Detect state management
      const stateManagement: string[] = [];
      if (allDeps['@ngrx/store']) stateManagement.push('ngrx');
      if (allDeps['@datorama/akita']) stateManagement.push('akita');
      if (allDeps['@ngneat/elf']) stateManagement.push('elf');

      // Detect UI libraries
      const uiLibraries: string[] = [];
      if (allDeps['@angular/material']) uiLibraries.push('Angular Material');
      if (allDeps['primeng']) uiLibraries.push('PrimeNG');
      if (allDeps['@ng-bootstrap/ng-bootstrap']) uiLibraries.push('ng-bootstrap');

      // Detect testing frameworks
      const testingFrameworks: string[] = [];
      if (allDeps['jasmine-core']) testingFrameworks.push('Jasmine');
      if (allDeps['karma']) testingFrameworks.push('Karma');
      if (allDeps['jest']) testingFrameworks.push('Jest');

      metadata.framework = {
        name: 'Angular',
        version: angularVersion,
        type: 'angular',
        variant: 'unknown', // Will be determined during analysis
        stateManagement,
        uiLibraries,
        testingFrameworks,
      };

      // Convert dependencies
      metadata.dependencies = Object.entries(allDeps).map(([name, version]) => ({
        name,
        version: version as string,
        category: this.categorizeDependency(name),
      }));

    } catch (error) {
      console.warn('Failed to read Angular project metadata:', error);
    }

    return metadata;
  }

  /**
   * Generate Angular-specific summary for a code chunk
   */
  summarize(chunk: CodeChunk): string {
    const { componentType, metadata, content } = chunk;
    const fileName = path.basename(chunk.filePath);

    // Extract class/component name
    const classMatch = content.match(/(?:export\s+)?class\s+(\w+)/);
    const className = classMatch ? classMatch[1] : fileName;

    switch (componentType) {
      case 'component':
        const selector = metadata.decorator?.selector || 'unknown';
        const inputs = metadata.decorator?.inputs?.length || 0;
        const outputs = metadata.decorator?.outputs?.length || 0;
        const lifecycle = this.extractLifecycleMethods(content);
        return `Angular component '${className}' (selector: ${selector})${lifecycle ? ` with ${lifecycle}` : ''}${inputs ? `, ${inputs} inputs` : ''}${outputs ? `, ${outputs} outputs` : ''}.`;

      case 'service':
        const providedIn = metadata.decorator?.providedIn || 'unknown';
        const methods = this.extractPublicMethods(content);
        return `Angular service '${className}' (providedIn: ${providedIn})${methods ? ` providing ${methods}` : ''}.`;

      case 'guard':
        const guardType = this.detectGuardType(content);
        return `Angular ${guardType} guard '${className}' protecting routes.`;

      case 'directive':
        const directiveSelector = metadata.decorator?.selector || 'unknown';
        return `Angular directive '${className}' (selector: ${directiveSelector}).`;

      case 'pipe':
        const pipeName = metadata.decorator?.name || 'unknown';
        return `Angular pipe '${className}' (name: ${pipeName}) for data transformation.`;

      case 'module':
        const imports = metadata.decorator?.imports?.length || 0;
        const declarations = metadata.decorator?.declarations?.length || 0;
        return `Angular module '${className}' with ${declarations} declarations and ${imports} imports.`;

      case 'interceptor':
        return `Angular HTTP interceptor '${className}' modifying HTTP requests/responses.`;

      default:
        // Generic fallback
        return `${componentType || 'Code'} in ${fileName}: ${this.extractFirstComment(content) || this.extractFirstLine(content)}`;
    }
  }

  private extractLifecycleMethods(content: string): string {
    const lifecycles = ['ngOnInit', 'ngOnChanges', 'ngOnDestroy', 'ngAfterViewInit', 'ngAfterContentInit'];
    const found = lifecycles.filter(method => content.includes(method));
    return found.length > 0 ? found.join(', ') : '';
  }

  private extractPublicMethods(content: string): string {
    const methodMatches = content.match(/public\s+(\w+)\s*\(/g);
    if (!methodMatches || methodMatches.length === 0) return '';
    const methods = methodMatches.slice(0, 3).map(m => m.match(/public\s+(\w+)/)?.[1]).filter(Boolean);
    return methods.length > 0 ? `methods: ${methods.join(', ')}` : '';
  }

  private detectGuardType(content: string): string {
    if (content.includes('CanActivate')) return 'CanActivate';
    if (content.includes('CanDeactivate')) return 'CanDeactivate';
    if (content.includes('CanLoad')) return 'CanLoad';
    if (content.includes('CanMatch')) return 'CanMatch';
    return 'route';
  }

  private extractFirstComment(content: string): string {
    const commentMatch = content.match(/\/\*\*\s*\n?\s*\*\s*(.+?)(?:\n|\*\/)/);
    return commentMatch ? commentMatch[1].trim() : '';
  }

  private extractFirstLine(content: string): string {
    const firstLine = content.split('\n').find(line => line.trim() && !line.trim().startsWith('import'));
    return firstLine ? firstLine.trim().slice(0, 60) + '...' : '';
  }
}
