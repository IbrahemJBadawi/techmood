'use client';

import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import { CANVAS_BLOCKS, CARD_COLOURS } from '@/lib/incubator';
import type { CanvasBlock, CanvasCard, CardColour } from '@/lib/database.types';

/**
 * The canvas is a live editing surface, so it talks to Supabase from the browser
 * rather than round-tripping a server action for every keystroke and drag. That
 * is safe because row level security — not this component — decides who may
 * write: can_edit_startup() gates every table and move_canvas_card().
 */
export function CanvasBoard({
  startupId,
  initialCards,
  canEdit,
}: {
  startupId: string;
  initialCards: CanvasCard[];
  canEdit: boolean;
}) {
  const [cards, setCards] = useState(initialCards);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [addingTo, setAddingTo] = useState<CanvasBlock | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropBlock, setDropBlock] = useState<CanvasBlock | null>(null);
  const [error, setError] = useState('');

  const supabase = createClient();

  function cardsIn(block: CanvasBlock) {
    return cards.filter((card) => card.block === block).sort((a, b) => a.sort_order - b.sort_order);
  }

  async function addCard(block: CanvasBlock, body: string) {
    const text = body.trim();
    if (!text) return;

    const { data, error: insertError } = await supabase
      .from('canvas_cards')
      .insert({
        startup_id: startupId,
        block,
        body_ar: text,
        sort_order: cardsIn(block).length,
      })
      .select('*')
      .single();

    if (insertError || !data) {
      setError('تعذّر إضافة البطاقة.');
      return;
    }

    setCards((current) => [...current, data as CanvasCard]);
    setAddingTo(null);
    setDraft('');
  }

  async function saveCard(id: string, body: string) {
    const text = body.trim();
    if (!text) return;

    setCards((current) => current.map((card) => (card.id === id ? { ...card, body_ar: text } : card)));
    setEditingId(null);

    const { error: updateError } = await supabase
      .from('canvas_cards')
      .update({ body_ar: text })
      .eq('id', id);

    if (updateError) setError('تعذّر حفظ التعديل.');
  }

  async function recolour(id: string, colour: CardColour) {
    setCards((current) => current.map((card) => (card.id === id ? { ...card, colour } : card)));
    const { error: updateError } = await supabase.from('canvas_cards').update({ colour }).eq('id', id);
    if (updateError) setError('تعذّر تغيير اللون.');
  }

  async function removeCard(id: string) {
    setCards((current) => current.filter((card) => card.id !== id));
    setEditingId(null);
    const { error: deleteError } = await supabase.from('canvas_cards').delete().eq('id', id);
    if (deleteError) setError('تعذّر حذف البطاقة.');
  }

  async function moveCard(id: string, block: CanvasBlock) {
    const card = cards.find((item) => item.id === id);
    if (!card || card.block === block) return;

    setCards((current) =>
      current.map((item) =>
        item.id === id ? { ...item, block, sort_order: cardsIn(block).length } : item,
      ),
    );

    // Ordering inside the destination is settled server-side, in one place.
    const { error: moveError } = await supabase.rpc('move_canvas_card', {
      p_card: id,
      p_block: block,
      p_index: null,
    });

    if (moveError) setError('تعذّر نقل البطاقة.');
  }

  return (
    <>
      {error && <p className="notice notice-danger section-block">{error}</p>}

      <div className="bmc">
        {CANVAS_BLOCKS.map((block) => (
          <section
            key={block.key}
            className={`bmc-block${dropBlock === block.key ? ' drop-target' : ''}`}
            style={{ gridArea: block.area }}
            onDragOver={(event) => {
              if (!canEdit || !dragId) return;
              event.preventDefault();
              setDropBlock(block.key);
            }}
            onDragLeave={() => setDropBlock((current) => (current === block.key ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              setDropBlock(null);
              if (dragId) void moveCard(dragId, block.key);
              setDragId(null);
            }}
          >
            <header>
              <h3>{block.label}</h3>
              <span className="badge-pill eng">{cardsIn(block.key).length}</span>
            </header>
            <p className="bmc-hint">{block.hint}</p>

            {cardsIn(block.key).map((card) =>
              editingId === card.id ? (
                <div className="bmc-card" key={card.id} style={{ cursor: 'default' }}>
                  <textarea
                    value={draft}
                    autoFocus
                    rows={3}
                    onChange={(event) => setDraft(event.target.value)}
                    style={{ width: '100%', fontSize: '0.8rem' }}
                  />

                  <div className="swatch-row">
                    {CARD_COLOURS.map((colour) => (
                      <button
                        key={colour}
                        type="button"
                        aria-label={`لون ${colour}`}
                        className={`swatch card-${colour}${card.colour === colour ? ' selected' : ''}`}
                        onClick={() => void recolour(card.id, colour)}
                      />
                    ))}
                  </div>

                  {/* A select, not only drag: this has to work on a phone and
                      with a keyboard. */}
                  <select
                    value={card.block}
                    onChange={(event) => void moveCard(card.id, event.target.value as CanvasBlock)}
                    style={{ width: '100%', fontSize: '0.76rem', marginBottom: 8 }}
                  >
                    {CANVAS_BLOCKS.map((option) => (
                      <option key={option.key} value={option.key}>انقل إلى: {option.label}</option>
                    ))}
                  </select>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => void saveCard(card.id, draft)}>
                      حفظ
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>إلغاء</button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--danger)', marginInlineStart: 'auto' }}
                      onClick={() => void removeCard(card.id)}
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={card.id}
                  className={`bmc-card card-${card.colour}${dragId === card.id ? ' dragging' : ''}`}
                  draggable={canEdit}
                  onDragStart={() => setDragId(card.id)}
                  onDragEnd={() => { setDragId(null); setDropBlock(null); }}
                  onClick={() => {
                    if (!canEdit) return;
                    setEditingId(card.id);
                    setDraft(card.body_ar);
                  }}
                >
                  {card.body_ar}
                </div>
              ),
            )}

            {canEdit && addingTo === block.key ? (
              <div>
                <textarea
                  autoFocus
                  rows={2}
                  value={draft}
                  placeholder="اكتب البطاقة…"
                  onChange={(event) => setDraft(event.target.value)}
                  style={{ width: '100%', fontSize: '0.8rem' }}
                />
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => void addCard(block.key, draft)}>
                    أضف
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setAddingTo(null); setDraft(''); }}>
                    إلغاء
                  </button>
                </div>
              </div>
            ) : (
              canEdit && (
                <button
                  className="add-card-btn"
                  onClick={() => { setAddingTo(block.key); setDraft(''); }}
                >
                  + بطاقة
                </button>
              )
            )}
          </section>
        ))}
      </div>
    </>
  );
}
