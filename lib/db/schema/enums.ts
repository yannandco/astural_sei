import { pgEnum } from 'drizzle-orm/pg-core'

// User roles
export const userRoleEnum = pgEnum('user_role', ['admin', 'user'])

// Log types
export const logTypeEnum = pgEnum('log_type', ['USER_ACTION', 'SYSTEM_EVENT', 'API_CALL'])

// Log priority
export const logPriorityEnum = pgEnum('log_priority', ['info', 'warning', 'error', 'critical'])
