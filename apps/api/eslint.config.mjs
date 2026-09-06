// @ts-check
import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'prisma/generated/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
    },
  },
  {
    // REGLA ARQUITECTÓNICA: el motor financiero es puro.
    // Si domain/ importa Nest o Prisma, deja de ser testeable sin base y sin app.
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@nestjs/*'], message: 'domain/ no puede depender de NestJS.' },
            { group: ['@prisma/*', '**/prisma/*'], message: 'domain/ no puede depender de Prisma.' },
            { group: ['@/infra/*', '@/modules/*'], message: 'domain/ no puede depender de infra ni de módulos.' },
          ],
        },
      ],
    },
  },
);
