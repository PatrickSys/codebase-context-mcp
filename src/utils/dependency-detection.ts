import { promises as fs } from 'fs';
import path from 'path';

import { Dependency as GlobalDependency } from '../types/index.js';

export interface Dependency {
    name: string;
    version: string;
    category: GlobalDependency['category'];
}

/**
 * Known libraries and their categories.
 * This centralized list helps different analyzers agree on what a library "is".
 */
export const LIBRARY_CATEGORIES: Record<string, Dependency['category']> = {
    // Frameworks
    'react': 'framework',
    'vue': 'framework',
    'angular': 'framework',
    'svelte': 'framework',
    'next': 'framework',
    'nuxt': 'framework',

    // UI & Styling
    'tailwindcss': 'ui',
    '@mui/material': 'ui',
    'styled-components': 'ui',
    '@emotion/react': 'ui',
    'framer-motion': 'ui',
    'lucide-react': 'ui',
    '@radix-ui/react-slot': 'ui',
    'class-variance-authority': 'ui',
    'clsx': 'ui',
    'tailwind-merge': 'ui',

    // State Management
    'redux': 'state',
    '@reduxjs/toolkit': 'state',
    'zustand': 'state',
    'jotai': 'state',
    'recoil': 'state',
    'mobx': 'state',
    '@tanstack/react-query': 'state',
    'swr': 'state',

    // Forms & Validation
    'react-hook-form': 'ui', // Often considers UI logic
    'formik': 'ui',
    'zod': 'utility',
    'yup': 'utility',
    'valibot': 'utility',

    // Backend / API
    'express': 'backend',
    'fastify': 'backend',
    'nest.js': 'backend',
    'prisma': 'backend',
    'mongoose': 'backend',

    // Testing
    'jest': 'testing',
    'vitest': 'testing',
    'cypress': 'testing',
    '@playwright/test': 'testing',
    '@testing-library/react': 'testing',

    // Build & Tools
    'typescript': 'build',
    'vite': 'build',
    'webpack': 'build',
    'esbuild': 'build',
    'eslint': 'build',
    'prettier': 'build',
    'nx': 'build',
    'turbo': 'build',
};

export async function readPackageJson(rootPath: string): Promise<Record<string, string>> {
    try {
        const packageJsonPath = path.join(rootPath, 'package.json');
        const content = await fs.readFile(packageJsonPath, 'utf-8');
        const pkg = JSON.parse(content);
        return {
            ...(pkg.dependencies || {}),
            ...(pkg.devDependencies || {}),
            ...(pkg.peerDependencies || {}),
        };
    } catch (error) {
        // If no package.json, return empty deps
        return {};
    }
}

/**
 * categorize a dependency based on the known list
 */
export function categorizeDependency(name: string): Dependency['category'] {
    // Exact match
    if (LIBRARY_CATEGORIES[name]) {
        return LIBRARY_CATEGORIES[name];
    }

    // Prefix matching (e.g. @angular/core -> framework)
    if (name.startsWith('@angular/')) return 'framework';
    if (name.startsWith('@nestjs/')) return 'other'; // No backend category in global types
    if (name.startsWith('@nx/')) return 'build';
    if (name.startsWith('@nrwl/')) return 'build';
    if (name.startsWith('@types/')) return 'build';

    return 'other';
}

// Re-export workspace detection utilities for unified API
export {
    scanWorkspacePackageJsons,
    detectWorkspaceType,
    aggregateWorkspaceDependencies,
    normalizePackageVersion,
    WorkspacePackageJson,
    WorkspaceType,
} from './workspace-detection.js';

