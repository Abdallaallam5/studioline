import { model, models, type Model, type Schema, type Types } from "mongoose";

export type Id = Types.ObjectId;

export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

/** Return the already-compiled model on hot reload instead of recompiling it. */
export function getModel<T>(name: string, schema: Schema<T>): Model<T> {
  return (models[name] as Model<T> | undefined) ?? model<T>(name, schema);
}
