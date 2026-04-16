type ErrorLike = {
  message?: unknown;
  status?: unknown;
  data?: unknown;
  technicalMessage?: unknown;
};

const DEFAULT_ERROR_MESSAGE =
  "Something did not complete. Please try again, or send a support ticket if it keeps happening.";
const REDEPLOY_MESSAGE =
  "This page is being refurbished. A new version is being installed, so please refresh in a moment.";

const TECHNICAL_ERROR_PATTERNS = [
  /\b(type|reference|syntax|range|eval|uri)error\b/i,
  /\b(prisma|sqlite|sql|database|constraint|stack trace|component stack)\b/i,
  /\b(undefined|null|nan)\b/i,
  /\b(cannot read|cannot set|is not a function|is not iterable)\b/i,
  /\b(json|parse|fetch failed|networkerror|failed to fetch)\b/i,
  /\b(request failed with status|status\s+[45]\d\d|internal server error)\b/i,
  /\b(hono|vite|react|chunk|module|import|export)\b/i,
  /\b(api key|secret|token|credential|authorization|unauthorized)\b/i,
  /\b(loading chunk|chunkloaderror|dynamically imported module|preloaderror)\b/i,
  /\/api\//i,
];

const REDEPLOY_ERROR_PATTERNS = [
  /\b(loading chunk|chunkloaderror|dynamically imported module|preloaderror)\b/i,
  /\b(gateway timeout|bad gateway|service unavailable|temporarily unavailable)\b/i,
  /\b(new version|redeploy|deployment|maintenance)\b/i,
];

function readErrorLike(input: unknown): ErrorLike {
  if (input instanceof Error) {
    return {
      message: input.message,
      status: (input as ErrorLike).status,
      data: (input as ErrorLike).data,
      technicalMessage: (input as ErrorLike).technicalMessage,
    };
  }

  if (typeof input === "object" && input !== null) {
    return input as ErrorLike;
  }

  if (typeof input === "string") {
    return { message: input };
  }

  return {};
}

function extractMessage(input: unknown): string {
  const errorLike = readErrorLike(input);
  const message = errorLike.message;

  if (typeof message === "string") {
    return message.trim();
  }

  if (typeof input === "string") {
    return input.trim();
  }

  return "";
}

function extractStatus(input: unknown): number | null {
  const status = readErrorLike(input).status;
  return typeof status === "number" ? status : null;
}

function looksTechnical(message: string) {
  return TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function mapStatusToMessage(status: number) {
  if (status === 400) {
    return "We could not use that input. Please check it and try again.";
  }

  if (status === 401 || status === 403) {
    return "Your session needs attention. Please sign in again to continue.";
  }

  if (status === 402) {
    return "This action needs more credits or a higher plan before it can continue.";
  }

  if (status === 404) {
    return "We could not find that item anymore. It may have been moved or deleted.";
  }

  if (status === 413) {
    return "That file is too large. Please try a smaller or simpler upload.";
  }

  if (status === 429) {
    return "Too many attempts in a short time. Please wait a moment and try again.";
  }

  if (status === 502 || status === 503 || status === 504) {
    return REDEPLOY_MESSAGE;
  }

  if (status >= 500) {
    return "Something went wrong on our side. Please try again, or send a support ticket.";
  }

  return null;
}

export function getUserFacingErrorMessage(
  input: unknown,
  options: { fallback?: string } = {},
) {
  const statusMessage = extractStatus(input);
  if (statusMessage !== null) {
    const mapped = mapStatusToMessage(statusMessage);
    if (mapped) return mapped;
  }

  const message = extractMessage(input);
  if (!message) {
    return options.fallback ?? DEFAULT_ERROR_MESSAGE;
  }

  if (isRedeployOrMaintenanceError(input)) {
    return REDEPLOY_MESSAGE;
  }

  if (looksTechnical(message)) {
    return options.fallback ?? DEFAULT_ERROR_MESSAGE;
  }

  return message;
}

export function isRedeployOrMaintenanceError(input: unknown) {
  const status = extractStatus(input);
  if (status === 502 || status === 503 || status === 504) {
    return true;
  }

  const message = extractMessage(input);
  return !!message && REDEPLOY_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function getErrorDiagnostics(input: unknown) {
  if (
    typeof input === "object" &&
    input !== null &&
    "error" in input
  ) {
    const nested = getErrorDiagnostics((input as { error: unknown }).error);
    return {
      ...nested,
      componentStack:
        "componentStack" in input
          ? (input as { componentStack?: unknown }).componentStack
          : undefined,
    };
  }

  const errorLike = readErrorLike(input);
  const technicalMessage =
    typeof errorLike.technicalMessage === "string"
      ? errorLike.technicalMessage
      : extractMessage(input);
  const status = extractStatus(input);

  return {
    message: technicalMessage || "No error message available",
    status,
    data: errorLike.data,
    stack: input instanceof Error ? input.stack : undefined,
  };
}
