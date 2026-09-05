import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { ProjectMember } from './entities/project-member.entity';
import { ProjectRepository } from './repositories/project.repository';
import { ProjectMemberRepository } from './repositories/project-member.repository';
import { ProjectService } from './services/project.service';
import { ProjectController } from './controllers/project.controller';
import { AuthModule } from '../auth/auth.module';
import { DiagramsModule } from '../diagrams/diagrams.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, ProjectMember]),
    forwardRef(() => DiagramsModule),
    AuthModule,
  ],
  controllers: [ProjectController],
  providers: [ProjectService, ProjectRepository, ProjectMemberRepository],
  exports: [ProjectService, ProjectRepository, ProjectMemberRepository],
})
export class ProjectsModule {}
