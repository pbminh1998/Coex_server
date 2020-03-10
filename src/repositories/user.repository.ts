import { DefaultCrudRepository, HasManyRepositoryFactory, repository } from '@loopback/repository';
import { User, UserRelations, Room } from '../models';
import { CoexdbDataSource } from '../datasources';
import { inject, Getter } from '@loopback/core';
import { RoomRepository } from './room.repository';

export type Credentials = {
  email: string;
  password: string;
};

export class UserRepository extends DefaultCrudRepository<
  User,
  typeof User.prototype.id,
  UserRelations
  > {
  public readonly rooms: HasManyRepositoryFactory<
    Room,
    typeof User.prototype.id
  >;
  constructor(
    @inject('datasources.coexdb') dataSource: CoexdbDataSource,
    @repository.getter('RoomRepository')
    getRoomRepository: Getter<RoomRepository>,
  ) {
    super(User, dataSource);
    this.rooms = this.createHasManyRepositoryFactoryFor(
      'rooms',
      getRoomRepository,
    );
  }
}
