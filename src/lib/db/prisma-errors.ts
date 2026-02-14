interface PrismaErrorLike {
  code?: unknown;
  meta?: {
    target?: unknown;
  };
}

function hasStringCode(
  error: PrismaErrorLike | null | undefined
): error is PrismaErrorLike & { code: string } {
  return Boolean(error && typeof error.code === 'string');
}

function parseError(error: unknown): PrismaErrorLike | null {
  if (!error || typeof error !== 'object') return null;
  return error as PrismaErrorLike;
}

export function isPrismaUniqueConstraintError(
  error: unknown,
  expectedTargetFields?: readonly string[]
): boolean {
  const parsed = parseError(error);
  if (!hasStringCode(parsed) || parsed.code !== 'P2002') return false;

  if (!expectedTargetFields || expectedTargetFields.length === 0) return true;

  const target = parsed.meta?.target;
  if (typeof target === 'string') {
    return expectedTargetFields.includes(target);
  }
  if (!Array.isArray(target)) return false;
  const targetFields = target.filter(
    (entry): entry is string => typeof entry === 'string'
  );

  return expectedTargetFields.every((field) => targetFields.includes(field));
}
