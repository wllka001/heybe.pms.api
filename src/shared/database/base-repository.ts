import { FilterQuery, Model, ProjectionType, QueryOptions, UpdateQuery } from 'mongoose';

export class BaseRepository<TDocument extends { _id: unknown; deletedAt?: Date | null }> {
  constructor(protected readonly model: Model<TDocument>) {}

  async create(payload: Partial<TDocument>): Promise<TDocument> {
    const created = new this.model(payload);
    return created.save();
  }

  async findOne(
    filter: FilterQuery<TDocument>,
    projection?: ProjectionType<TDocument>,
    options?: QueryOptions<TDocument>,
  ): Promise<TDocument | null> {
    return this.model.findOne({ ...filter, deletedAt: null }, projection, options);
  }

  async findMany(
    filter: FilterQuery<TDocument>,
    projection?: ProjectionType<TDocument>,
    options?: QueryOptions<TDocument>,
  ): Promise<TDocument[]> {
    return this.model.find({ ...filter, deletedAt: null }, projection, options);
  }

  async updateOne(
    filter: FilterQuery<TDocument>,
    update: UpdateQuery<TDocument>,
  ): Promise<TDocument | null> {
    return this.model.findOneAndUpdate({ ...filter, deletedAt: null }, update, {
      new: true,
    });
  }

  async softDelete(filter: FilterQuery<TDocument>): Promise<TDocument | null> {
    return this.model.findOneAndUpdate(
      { ...filter, deletedAt: null },
      { deletedAt: new Date() } as UpdateQuery<TDocument>,
      { new: true },
    );
  }
}
