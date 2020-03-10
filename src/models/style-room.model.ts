import { Model, model, property, Entity, belongsTo } from '@loopback/repository';
import { Room, RoomRelations } from './room.model';

@model()
export class StyleRoom extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id?: string;

  @property({
    type: 'string',
    required: true,
  })
  name: string;

  @property({
    type: 'string',
    required: true,
  })
  about: string;

  @property({
    type: 'number',
    required: true,
  })
  price: number;

  @property({
    type: 'number',
    required: true,
  })
  maxPerson: number;

  @belongsTo(() => Room)
  roomId: string;

  constructor(data?: Partial<StyleRoom>) {
    super(data);
  }
}

export interface StyleRoomRelations {
  room?: RoomRelations;
}

export type StyleRoomWithRelations = StyleRoom & StyleRoomRelations;
