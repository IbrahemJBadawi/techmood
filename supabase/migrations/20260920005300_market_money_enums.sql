-- =============================================================================
-- 0053 — The values the market's money needs
--
-- A file of its own, as 0015, 0017, 0027 and 0049 were: a value added to an
-- enum cannot be used in the same transaction that added it.
--
-- Market conversations are the reason for the first one. A negotiation about a
-- price, a question about a deliverable and an argument about a deadline are
-- all messages, and TechMood already has one place for messages. What it did
-- not have is a kind of conversation that belongs to a piece of work.
-- =============================================================================

alter type public.conversation_kind add value if not exists 'market' after 'mentor_booking';

-- A project that was sold is neither planning nor in progress: it is finished
-- work that changed hands, and the ladder has to be able to say so.
alter type public.project_status add value if not exists 'sold' after 'completed';
