import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
    {
        ignores: [
            'node_modules/**',
            '.next/**',
            'dist/**',
            'release/**',
            'coverage/**',
            'packages/**/dist/**',
            'public/**',
        ],
    },
    ...compat.extends('next/core-web-vitals'),
];

export default eslintConfig;
