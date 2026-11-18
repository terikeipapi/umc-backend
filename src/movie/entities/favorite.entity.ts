import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { BaseTimeEntity } from './base-time.entity.js';
import { Member } from './member.entity.js';
import { movieIdTransformer } from './movie-id.transformer.js';

@Entity('favorite')
@Unique('uq_favorite_member_movie', ['member', 'movieId'])
export class Favorite extends BaseTimeEntity {
  @PrimaryGeneratedColumn({ name: 'favorite_id', type: 'int', unsigned: true })
  favoriteId!: number;

  @ManyToOne(() => Member, { nullable: false })
  @JoinColumn({ name: 'member_id' })
  member!: Relation<Member>;

  // External TMDB identifier, not a foreign key to a local movie table.
  @Column({
    name: 'movie_id',
    type: 'bigint',
    unsigned: true,
    transformer: movieIdTransformer,
  })
  movieId!: number;
}
