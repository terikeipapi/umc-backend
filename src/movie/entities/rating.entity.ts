import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Member } from './member.entity.js';
import { movieIdTransformer } from './movie-id.transformer.js';

@Entity('rating')
@Unique('uq_rating_member_movie', ['member', 'movieId'])
export class Rating {
  @PrimaryGeneratedColumn({ name: 'rating_id', type: 'int', unsigned: true })
  ratingId!: number;

  @ManyToOne(() => Member, { nullable: false })
  @JoinColumn({ name: 'member_id' })
  member!: Relation<Member>;

  @Column({
    name: 'movie_id',
    type: 'bigint',
    unsigned: true,
    transformer: movieIdTransformer,
  })
  movieId!: number;

  @Column({ type: 'tinyint', unsigned: true })
  score!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  comment!: string | null;
}
