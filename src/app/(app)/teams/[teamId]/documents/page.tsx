import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { DOCUMENT_KINDS } from '@/lib/teams';

import { TeamNav } from '../TeamNav';
import { NewDocumentForm } from './NewDocumentForm';
import { removeDocument } from './actions';

export default async function TeamDocumentsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: team } = await supabase.from('teams').select('id, title_ar').eq('id', teamId).maybeSingle();
  if (!team) notFound();

  const [{ data: documents }, { data: projects }, { data: canWrite }] = await Promise.all([
    supabase.from('team_documents').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
    supabase.from('projects').select('id, title_ar').eq('team_id', teamId),
    supabase.rpc('team_permission', { p_team: teamId, p_permission: 'members_manage_docs' }),
  ]);

  const authorIds = [...new Set((documents ?? []).map((row) => row.author_id))];
  const { data: authors } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', authorIds.length ? authorIds : ['00000000-0000-0000-0000-000000000000']);

  const authorById = new Map((authors ?? []).map((row) => [row.id, row.full_name]));
  const projectById = new Map((projects ?? []).map((row) => [row.id, row.title_ar]));
  const groups = [...new Set(DOCUMENT_KINDS.map((kind) => kind.group))];

  return (
    <>
      <section className="section-block">
        <div className="row-between">
          <h2 style={{ fontSize: '1.15rem' }}>{team.title_ar} — المستندات</h2>
          <Link className="btn btn-ghost btn-sm" href={`/teams/${teamId}`}>نظرة عامة</Link>
        </div>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: 6 }}>
          مستندات مصنّفة بدل ملفات ضائعة في المحادثة. كل مستند له نوع، ويمكن ربطه بمشروع.
        </p>
      </section>

      <TeamNav teamId={teamId} />

      {canWrite === true && (
        <NewDocumentForm teamId={teamId} projects={projects ?? []} />
      )}

      {(documents?.length ?? 0) === 0 ? (
        <p className="notice">لا مستندات بعد.</p>
      ) : (
        groups.map((group) => {
          const kindsInGroup = DOCUMENT_KINDS.filter((kind) => kind.group === group).map((kind) => kind.key);
          const groupDocuments = (documents ?? []).filter((row) => kindsInGroup.includes(row.kind));
          if (groupDocuments.length === 0) return null;

          return (
            <section className="section-block" key={group}>
              <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>{group}</h3>

              {groupDocuments.map((document) => (
                <article className="panel" key={document.id} style={{ marginBottom: 12 }}>
                  <div className="row-between" style={{ alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ fontSize: '0.95rem' }}>{document.title_ar}</h4>
                      <div className="tags-row" style={{ marginTop: 6 }}>
                        <span className="tag">
                          {DOCUMENT_KINDS.find((kind) => kind.key === document.kind)?.label ?? document.kind}
                        </span>
                        {document.project_id && (
                          <span className="badge-pill">{projectById.get(document.project_id)}</span>
                        )}
                      </div>
                    </div>
                    {canWrite === true && (
                      <form action={removeDocument}>
                        <input type="hidden" name="document_id" value={document.id} />
                        <input type="hidden" name="team_id" value={teamId} />
                        <button className="btn btn-ghost btn-sm" style={{ padding: '3px 9px', fontSize: '0.72rem' }}>
                          حذف
                        </button>
                      </form>
                    )}
                  </div>

                  {document.body_ar && (
                    <p style={{ fontSize: '0.88rem', marginTop: 12, whiteSpace: 'pre-wrap' }}>{document.body_ar}</p>
                  )}

                  {document.url && (
                    <a
                      className="badge-pill eng"
                      style={{ marginTop: 10, display: 'inline-block', textDecoration: 'none' }}
                      href={document.url}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      ↗ فتح الرابط
                    </a>
                  )}

                  <p className="muted eng" style={{ fontSize: '0.74rem', marginTop: 10 }}>
                    {authorById.get(document.author_id) ?? '—'} ·{' '}
                    {new Date(document.created_at).toLocaleDateString('ar-EG')}
                  </p>
                </article>
              ))}
            </section>
          );
        })
      )}
    </>
  );
}
