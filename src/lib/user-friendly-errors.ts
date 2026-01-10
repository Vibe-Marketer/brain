/**
 * User-Friendly Error Messages
 *
 * Converts technical errors into helpful, actionable messages for users.
 * NO MORE "Failed to fetch" or "Invalid JWT" - users get clear guidance on what to do.
 */

export interface UserFriendlyError {
  title: string;
  message: string;
  action?: string; // What the user should do
  canRetry?: boolean; // Can they try again?
}

/**
 * Convert any error to a user-friendly message
 *
 * @example
 * const error = new Error("Failed to fetch");
 * const friendly = getUserFriendlyError(error);
 * toast.error(friendly.message); // "We couldn't connect to the server. Check your internet connection and try again."
 */
export function getUserFriendlyError(
  error: unknown,
  context?: string
): UserFriendlyError {
  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  // Auth/Session Errors
  if (
    errorMessage.includes('invalid jwt') ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('401') ||
    errorMessage.includes('authentication')
  ) {
    return {
      title: 'Session Expired',
      message: 'Your session has expired. Please sign in again to continue.',
      action: 'Sign In',
      canRetry: false,
    };
  }

  // Network Errors
  if (
    errorMessage.includes('load failed') ||
    errorMessage.includes('fetch failed') ||
    errorMessage.includes('network') ||
    errorMessage.includes('failed to fetch') ||
    errorMessage.includes('networkerror')
  ) {
    return {
      title: 'Connection Problem',
      message: 'We couldn\'t connect to the server. Check your internet connection and try again.',
      action: 'Try Again',
      canRetry: true,
    };
  }

  // Permission Errors
  if (
    errorMessage.includes('forbidden') ||
    errorMessage.includes('403') ||
    errorMessage.includes('permission')
  ) {
    return {
      title: 'Access Denied',
      message: 'You don\'t have permission to do that. Contact your team admin if you need access.',
      action: 'Contact Admin',
      canRetry: false,
    };
  }

  // Not Found Errors
  if (
    errorMessage.includes('not found') ||
    errorMessage.includes('404')
  ) {
    return {
      title: 'Not Found',
      message: context
        ? `We couldn't find that ${context}. It may have been deleted or moved.`
        : 'We couldn\'t find what you\'re looking for. It may have been deleted.',
      action: 'Go Back',
      canRetry: false,
    };
  }

  // Rate Limit Errors
  if (
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests') ||
    errorMessage.includes('429')
  ) {
    return {
      title: 'Slow Down',
      message: 'You\'re doing that too quickly. Wait a moment and try again.',
      action: 'Wait & Retry',
      canRetry: true,
    };
  }

  // Timeout Errors
  if (
    errorMessage.includes('timeout') ||
    errorMessage.includes('timed out')
  ) {
    return {
      title: 'Request Timed Out',
      message: 'That took too long. Try again - if it keeps happening, the server might be overloaded.',
      action: 'Try Again',
      canRetry: true,
    };
  }

  // Server Errors
  if (
    errorMessage.includes('500') ||
    errorMessage.includes('502') ||
    errorMessage.includes('503') ||
    errorMessage.includes('server error') ||
    errorMessage.includes('internal error')
  ) {
    return {
      title: 'Server Problem',
      message: 'Something went wrong on our end. We\'ve been notified and are working on it.',
      action: 'Try Again Later',
      canRetry: true,
    };
  }

  // Validation Errors
  if (
    errorMessage.includes('invalid') ||
    errorMessage.includes('validation') ||
    errorMessage.includes('required') ||
    errorMessage.includes('must be')
  ) {
    return {
      title: 'Invalid Input',
      message: error instanceof Error ? error.message : 'Please check your input and try again.',
      action: 'Fix & Retry',
      canRetry: true,
    };
  }

  // Database/Query Errors
  if (
    errorMessage.includes('duplicate') ||
    errorMessage.includes('already exists')
  ) {
    return {
      title: 'Already Exists',
      message: context
        ? `That ${context} already exists. Try a different name.`
        : 'That already exists. Try a different name.',
      action: 'Use Different Name',
      canRetry: true,
    };
  }

  // Supabase-specific errors
  if (errorMessage.includes('supabase')) {
    return {
      title: 'Database Error',
      message: 'We had trouble saving your changes. Try again in a moment.',
      action: 'Try Again',
      canRetry: true,
    };
  }

  // Generic fallback - but still better than raw error
  return {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred. Try again - if it keeps happening, contact support.',
    action: 'Try Again',
    canRetry: true,
  };
}

/**
 * Context-specific error messages for common operations
 */
export const ErrorContexts = {
  CHAT: 'chat message',
  SESSION: 'chat session',
  CALL: 'call recording',
  TRANSCRIPT: 'transcript',
  FOLDER: 'folder',
  TAG: 'tag',
  SYNC: 'sync operation',
  EXPORT: 'export',
  SHARE: 'sharing',
  TEAM: 'team member',
  SETTINGS: 'settings',
  SEARCH: 'search',
} as const;

/**
 * Get a user-friendly error message with automatic retry suggestion
 */
export function getErrorToastMessage(error: unknown, context?: string): string {
  const friendly = getUserFriendlyError(error, context);

  let message = friendly.message;

  if (friendly.canRetry && friendly.action) {
    message += ` (${friendly.action})`;
  }

  return message;
}

/**
 * Common success messages
 */
export const SuccessMessages = {
  SAVED: 'Saved successfully',
  DELETED: 'Deleted successfully',
  CREATED: 'Created successfully',
  UPDATED: 'Updated successfully',
  COPIED: 'Copied to clipboard',
  SHARED: 'Shared successfully',
  EXPORTED: 'Exported successfully',
  SYNCED: 'Synced successfully',
  SENT: 'Sent successfully',
} as const;
