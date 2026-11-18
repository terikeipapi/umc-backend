import { Global, Module } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';

// Older auth/rating tests isolate the raw mysql service. Provide the new ORM
// wiring without creating a real DB connection; these tests never use it.
@Global()
@Module({
  providers: [
    {
      provide: getDataSourceToken(),
      useValue: {
        entityMetadatas: [],
        options: { type: 'mysql' },
        getRepository: () => ({}),
        transaction: () => {
          throw new Error('Unexpected ORM transaction in isolated legacy test');
        },
      },
    },
  ],
  exports: [getDataSourceToken()],
})
export class MockMovieOrmModule {}
