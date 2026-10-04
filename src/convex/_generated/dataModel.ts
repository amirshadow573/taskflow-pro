// Static preview type fallback. Production Convex deployments regenerate this file.
export type Id<TableName extends string = string> = string & { readonly __tableName?: TableName };
export type Doc<TableName extends string = string> = Record<string, unknown> & { readonly _id: Id<TableName>; readonly _creationTime: number };
