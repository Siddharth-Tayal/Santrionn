import next from 'eslint-config-next';

export default [
  ...next(),
  {
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['**/lib/server/*'], importNames: [], message: 'Do not import server-only modules from client code.' },
        ],
      }],
    },
  },
];
