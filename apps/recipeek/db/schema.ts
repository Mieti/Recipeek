import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(), name: text('name').notNull(), bio: text('bio').notNull().default(''), discoverable: integer('discoverable').notNull().default(0), createdAt: text('created_at').notNull(),
});
export const recipes = sqliteTable('recipes', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull().references(() => profiles.id), title: text('title').notNull(), category: text('category').notNull(), method: text('method').notNull(), visibility: text('visibility').notNull().default('private'), favorite: integer('favorite').notNull().default(0), collection: text('collection').notNull().default(''), document: text('document').notNull(), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(), deletedAt: text('deleted_at'),
});
export const ingredients = sqliteTable('ingredients', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull().references(() => profiles.id), canonical: text('canonical').notNull(), display: text('display').notNull(),
});
export const recipeIngredients = sqliteTable('recipe_ingredients', {
  recipeId: text('recipe_id').notNull().references(() => recipes.id), ingredientId: text('ingredient_id').notNull().references(() => ingredients.id),
}, table => [primaryKey({columns: [table.recipeId, table.ingredientId]})]);
export const follows = sqliteTable('follows', {
  followerId: text('follower_id').notNull().references(() => profiles.id), followedId: text('followed_id').notNull().references(() => profiles.id),
}, table => [primaryKey({columns: [table.followerId, table.followedId]})]);
export const uploads = sqliteTable('uploads', { id: text('id').primaryKey(), ownerId: text('owner_id').notNull().references(() => profiles.id), name: text('name').notNull(), contentType: text('content_type').notNull(), createdAt: text('created_at').notNull(), byteSize: integer('byte_size').notNull().default(6000000), state: text('state').notNull().default('ready'), lastUsedAt: text('last_used_at') });
export const requestLimits = sqliteTable('request_limits', {
  ownerId: text('owner_id').notNull(), scope: text('scope').notNull(), windowStart: integer('window_start').notNull(), expiresAt: integer('expires_at').notNull(), hits: integer('hits').notNull(),
}, table => [primaryKey({columns:[table.ownerId,table.scope,table.windowStart]})]);
export const externalIdentities = sqliteTable('external_identities', {
  authUserId:text('auth_user_id').primaryKey(),
  profileId:text('profile_id').notNull().unique().references(()=>profiles.id),
  createdAt:text('created_at').notNull(),
});
export const aiImports=sqliteTable('ai_imports',{
  id:text('id').primaryKey(),ownerId:text('owner_id').notNull().references(()=>profiles.id),
  status:text('status').notNull(),document:text('document').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
  lease:text('lease'),leaseUntil:integer('lease_until').notNull().default(0),
  nextRunAt:integer('next_run_at').notNull().default(0),attempts:integer('attempts').notNull().default(0),
  inputKey:text('input_key'),generation:integer('generation').notNull().default(0),
},table=>[index('ai_import_due').on(table.status,table.nextRunAt,table.leaseUntil),index('ai_import_owner_created').on(table.ownerId,table.createdAt),index('ai_import_created').on(table.createdAt),uniqueIndex('ai_import_generation').on(table.inputKey,table.generation),index('ai_import_lease').on(table.leaseUntil)]);
export const aiQueueState=sqliteTable('ai_queue_state',{id:text('id').primaryKey(),lastTick:integer('last_tick').notNull()});
export const aiProviderState=sqliteTable('ai_provider_state',{id:text('id').primaryKey(),nextAt:integer('next_at').notNull()});
export const aiImportBudget=sqliteTable('ai_import_budget',{
  id:text('id').primaryKey(),jobId:text('job_id').notNull(),ownerId:text('owner_id').notNull(),provider:text('provider').notNull(),month:text('month').notNull(),charge:integer('charge').notNull(),known:integer('known').notNull().default(0),createdAt:text('created_at').notNull(),
},table=>[index('ai_budget_month').on(table.provider,table.month)]);
