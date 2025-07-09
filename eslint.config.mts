import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['src/**/*.ts', 'src/**/*.tsx'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                project: './tsconfig.json',
            },
        },
        rules: {
            // Add any custom rules here
        },
    },
    {
        ignores: ['dist/**', 'node_modules/**', 'terraform/**'],
    },
);
