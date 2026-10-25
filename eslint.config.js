export default [
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                console: 'readonly',
                TextDecoder: 'readonly',
                TextEncoder: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['warn', {argsIgnorePattern: '^_'}],
            'no-undef': 'off',
        },
    },
];
