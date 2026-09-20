import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { TeamNav } from '../TeamNav';
import { ProjectCard } from './ProjectCard';
import { NewProjectForm } from './NewProjectForm';

export default async function TeamProjectsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: team } = await supabase.from('teams').select('id, title_ar, leader_id').eq('id', teamId).maybeSingle();
  if (!team) notFound();

  const [{ data: projects }, { data: tasks }] = await Promise.all([
    supabase.from('projects').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
    supabase.from('team_tasks').select('id, project_id, column_key, assignee_id').eq('team_id', teamId),
  ]);

  const projectIds = (projects ?? []).map((row) => row.id);

  const { data: entries } = await supabase
    .from('exhibition_entries')
    .select('id, project_id, entry_code, status, review_note_ar')
    .in('project_id', projectIds.length ? projectIds : ['00000000-0000-0000-0000-000000000000']);

  const entryByProject = new Map((entries ?? []).map((row) => [row.project_id, row]));
  const canManage = team.leader_id === user.id;

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.15rem' }}>{team.title_ar} — المشاريع</h2>
          <Link className="btn btn-ghost btn-sm" href="/exhibition">المعرض</Link>
        </div>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6 }}>
          عندما يكتمل مشروع، قدّمه للمعرض — عندها يصبح دليلاً مهنياً في ملف كل من عمل عليه.
        </p>
      </section>

      <TeamNav teamId={teamId} />

      {canManage && <NewProjectForm teamId={teamId} />}

      {(projects?.length ?? 0) === 0 ? (
        <p className="notice">لا مشاريع في هذا الفريق بعد.</p>
      ) : (
        projects!.map((project) => (
          <ProjectCard
            key={project.id}
            teamId={teamId}
            project={project}
            entry={entryByProject.get(project.id) ?? null}
            taskCount={(tasks ?? []).filter((task) => task.project_id === project.id).length}
            doneCount={
              (tasks ?? []).filter((task) => task.project_id === project.id && task.column_key === 'done').length
            }
            canManage={canManage}
          />
        ))
      )}
    </>
  );
}
