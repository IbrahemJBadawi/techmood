import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

/**
 * /submissions/<id> — where an evaluation notification points (0009,
 * notify_on_evaluation). A piece of work has no page of its own: it lives on
 * the lesson, course or path it answers, where its evaluations and the
 * «hand in again» form already are. So this only finds that place and goes
 * there.
 *
 * The person reading is the submission's owner, or a mentor/admin (RLS decides
 * who may read the submission at all). A mentor or admin is sent to the review
 * page instead, where they act on it.
 */
export default async function SubmissionRedirect({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/submissions/${submissionId}`);

  const { data: submission } = await supabase
    .from('submissions')
    .select('id, profile_id, assignment_id')
    .eq('id', submissionId)
    .maybeSingle();
  if (!submission) notFound();

  if (submission.profile_id !== user.id) redirect(`/review/${submission.id}`);

  const { data: assignment } = await supabase
    .from('assignments')
    .select('lesson_id, course_id, path_id')
    .eq('id', submission.assignment_id)
    .maybeSingle();
  if (!assignment) redirect('/academy');

  // A path's own project is handed in on the path page.
  if (assignment.path_id) {
    const { data: path } = await supabase.from('learning_paths').select('slug').eq('id', assignment.path_id).maybeSingle();
    redirect(path ? `/academy/${path.slug}` : '/academy');
  }

  // A lesson's work lives on the lesson; a course project on the course.
  let courseId = assignment.course_id;
  let lessonSlug: string | null = null;
  if (assignment.lesson_id) {
    const { data: lesson } = await supabase
      .from('lessons')
      .select('slug, modules(course_id)')
      .eq('id', assignment.lesson_id)
      .maybeSingle();
    lessonSlug = lesson?.slug ?? null;
    courseId = (lesson?.modules as unknown as { course_id: string } | null)?.course_id ?? courseId;
  }
  if (!courseId) redirect('/academy');

  const { data: course } = await supabase.from('courses').select('slug, status').eq('id', courseId).maybeSingle();
  // A course the admin has since hidden or switched off has no page to open.
  if (!course || course.status === 'draft' || course.status === 'archived') redirect('/academy');

  // The path in the address: one the person is on, else any open path with the course.
  const { data: links } = await supabase
    .from('path_courses')
    .select('learning_paths(id, slug, status)')
    .eq('course_id', courseId);
  const paths = (links ?? [])
    .map((row) => row.learning_paths as unknown as { id: string; slug: string; status: string } | null)
    .filter((path): path is { id: string; slug: string; status: string } => Boolean(path) && path!.status !== 'draft' && path!.status !== 'archived');
  const { data: enrolled } = paths.length
    ? await supabase.from('enrollments').select('path_id').eq('profile_id', user.id).in('path_id', paths.map((path) => path.id))
    : { data: [] };
  const mine = new Set((enrolled ?? []).map((row) => row.path_id));
  const path = paths.find((candidate) => mine.has(candidate.id)) ?? paths[0];
  if (!path) redirect('/academy');

  redirect(lessonSlug
    ? `/academy/${path.slug}/${course.slug}/${lessonSlug}`
    : `/academy/${path.slug}/${course.slug}`);
}
