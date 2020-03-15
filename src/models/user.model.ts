import { Entity, model, property, hasMany } from '@loopback/repository';
import { Room } from './room.model'

@model()
export class User extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id: string;

  @property({
    type: 'string',
    required: true,
    index: {
      unique: true,
    },
  })
  email: string;

  @property({
    type: 'string',
    required: true,
  })
  password: string;

  @property({
    type: 'string',
  })
  name: string;

  @property({
    type: 'string',
  })
  phone?: string;

  @property({
    type: 'boolean',
    required: true,
  })
  typeUser: boolean;

  @property({
    type: 'string',
  })
  address: string;

  @property({
    type: 'array',
    itemType: 'number',
  })
  location?: number[];

  @property({
    type: 'number',
  })
  distance?: number;

  @hasMany(() => Room, { keyTo: 'userId' })
  rooms: Room[];

  @property({
    type: 'array',
    itemType: 'string',
    default: []
  })
  token: string[];

  constructor(data?: Partial<User>) {
    super(data);
  }
}

export interface UserRelations {
  // describe navigational properties here
}

export type UserWithRelations = User & UserRelations;
