import { DefaultCrudRepository, BelongsToAccessor, repository } from '@loopback/repository';
import { StyleRoom, StyleRoomRelations, Room } from '../models';
import { CoexdbDataSource } from '../datasources';
import { inject, Getter } from '@loopback/core';
import { RoomRepository } from './room.repository';

export class StyleRoomRepository extends DefaultCrudRepository<
  StyleRoom,
  typeof StyleRoom.prototype.id,
  StyleRoomRelations
  > {
  public readonly room: BelongsToAccessor<
    Room,
    typeof StyleRoom.prototype.id
  >;
  constructor(
    @inject('datasources.coexdb') dataSource: CoexdbDataSource,
    @repository.getter('RoomRepository')
    roomRepositoryGetter: Getter<RoomRepository>,
  ) {
    super(StyleRoom, dataSource);
    this.room = this.createBelongsToAccessorFor(
      'room',
      roomRepositoryGetter,
    );
  }
}
