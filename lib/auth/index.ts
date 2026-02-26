import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { hash, verify } from '@node-rs/argon2'
import { eq } from 'drizzle-orm'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      ...schema,
      user: schema.users,
      session: schema.sessions,
    },
  }),
  emailAndPassword: {
    enabled: true,
    password: {
      hash: (password) =>
        hash(password, {
          memoryCost: 19456,
          timeCost: 2,
          outputLen: 32,
          parallelism: 1,
        }),
      verify: ({ hash: hashed, password }) => verify(hashed, password),
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh every day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  user: {
    modelName: 'users',
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'user',
        input: false,
      },
      isActive: {
        type: 'boolean',
        required: false,
        defaultValue: true,
        input: false,
      },
      lastLoginAt: {
        type: 'date',
        required: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          await db
            .update(schema.users)
            .set({ lastLoginAt: new Date() })
            .where(eq(schema.users.id, session.userId))
        },
      },
    },
  },
  plugins: [
    admin({ defaultRole: 'user', adminRoles: ['admin'] }),
    nextCookies(),
  ],
})
