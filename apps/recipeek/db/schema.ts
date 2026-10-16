import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(), name: text('name').notNull(), bio: text('bio').notNull().default(''), discoverable: integer('discoverable').notNull().default(0), createdAt: text('created_at').notNull(),
});
export const recipes = sqliteTable('recipes', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull().references(() => profiles.id), title: text('title').notNull(), category: text('category').notNull(), method: text('method').notNull(), visibility: text('visibility').notNull().default('private'), favorite: integer('favorite').notNull().default(0), collection: text('collection').notNull().default(''), document: text('document').notNull(), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
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
export const uploads = sqliteTable('uploads', { id: text('id').primaryKey(), ownerId: text('owner_id').notNull().references(() => profiles.id), name: text('name').notNull(), contentType: text('content_type').notNull(), createdAt: text('created_at').notNull() });
