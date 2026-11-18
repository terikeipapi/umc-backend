import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Map existing week 6/7 columns without enabling schema synchronization.
@Entity('member')
export class Member {
  @PrimaryGeneratedColumn({ name: 'member_id', type: 'int', unsigned: true })
  memberId!: number;

  @Column({ type: 'varchar', length: 254 })
  email!: string;

  @Column({ type: 'varchar', length: 60, select: false })
  password!: string;

  @Column({ type: 'varchar', length: 12 })
  nickname!: string;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
