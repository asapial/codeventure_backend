// Set test env *before* any module that reads process.env is imported.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/codeventure_test";
process.env.BETTER_AUTH_SECRET ??= "test-secret-do-not-use-in-prod";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
