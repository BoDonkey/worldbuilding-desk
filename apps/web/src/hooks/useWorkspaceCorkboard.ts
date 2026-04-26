import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {ChapterCard, ChapterCardStatus, PlotPoint} from '../entityTypes';
import {
  deleteChapterCard,
  getChapterCardsByProjectId,
  saveChapterCard
} from '../corkboardStorage';

export type CorkboardSaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

const DEFAULT_CARD_STATUS: ChapterCardStatus = 'planned';

const sortCards = (cards: ChapterCard[]): ChapterCard[] =>
  [...cards].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);

const sortPlotPoints = (plotPoints: PlotPoint[]): PlotPoint[] =>
  [...plotPoints].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);

const normalizeCardOrders = (cards: ChapterCard[]): ChapterCard[] =>
  sortCards(cards).map((card, index) => ({
    ...card,
    order: index,
    plotPoints: sortPlotPoints(card.plotPoints).map((plotPoint, plotIndex) => ({
      ...plotPoint,
      order: plotIndex
    }))
  }));

export function useWorkspaceCorkboard(projectId: string | null) {
  const [cards, setCards] = useState<ChapterCard[]>([]);
  const [status, setStatus] = useState<CorkboardSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [isHydrated, setHydrated] = useState(false);
  const [isDirty, setDirty] = useState(false);
  const deletedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!projectId) {
      setCards([]);
      setStatus('idle');
      setLastSavedAt(null);
      setHydrated(false);
      setDirty(false);
      deletedIdsRef.current = new Set();
      return;
    }

    let cancelled = false;
    setHydrated(false);
    setStatus('loading');
    getChapterCardsByProjectId(projectId)
      .then((loadedCards) => {
        if (cancelled) return;
        const normalized = normalizeCardOrders(loadedCards);
        setCards(normalized);
        setLastSavedAt(
          normalized.reduce<number | null>(
            (latest, card) => (latest === null || card.updatedAt > latest ? card.updatedAt : latest),
            null
          )
        );
        setHydrated(true);
        setDirty(false);
        deletedIdsRef.current = new Set();
        setStatus('saved');
      })
      .catch(() => {
        if (cancelled) return;
        setCards([]);
        setHydrated(true);
        setDirty(false);
        deletedIdsRef.current = new Set();
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !isHydrated || !isDirty) return;

    setStatus('saving');
    const timeoutId = window.setTimeout(() => {
      const cardsToSave = normalizeCardOrders(cards);
      const deletions = Array.from(deletedIdsRef.current);
      Promise.all([
        ...cardsToSave.map((card) => saveChapterCard(card)),
        ...deletions.map((id) => deleteChapterCard(id))
      ])
        .then(() => {
          const now = Date.now();
          setCards(cardsToSave);
          deletedIdsRef.current = new Set();
          setDirty(false);
          setLastSavedAt(now);
          setStatus('saved');
        })
        .catch(() => {
          setStatus('error');
        });
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [cards, isDirty, isHydrated, projectId]);

  const updateCards = useCallback((updater: (prev: ChapterCard[]) => ChapterCard[]) => {
    setCards((prev) => normalizeCardOrders(updater(prev)));
    setDirty(true);
  }, []);

  const createCard = useCallback(() => {
    if (!projectId) return;
    const now = Date.now();
    updateCards((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        projectId,
        title: '',
        summary: '',
        status: DEFAULT_CARD_STATUS,
        order: prev.length,
        plotPoints: [],
        createdAt: now,
        updatedAt: now
      }
    ]);
  }, [projectId, updateCards]);

  const updateCard = useCallback(
    (
      cardId: string,
      patch: Partial<Pick<ChapterCard, 'title' | 'summary' | 'status'>>
    ) => {
      updateCards((prev) =>
        prev.map((card) =>
          card.id === cardId ? {...card, ...patch, updatedAt: Date.now()} : card
        )
      );
    },
    [updateCards]
  );

  const deleteCard = useCallback(
    (cardId: string) => {
      deletedIdsRef.current.add(cardId);
      updateCards((prev) => prev.filter((card) => card.id !== cardId));
    },
    [updateCards]
  );

  const moveCard = useCallback(
    (cardId: string, direction: -1 | 1) => {
      updateCards((prev) => {
        const next = [...prev];
        const index = next.findIndex((card) => card.id === cardId);
        const targetIndex = index + direction;
        if (index < 0 || targetIndex < 0 || targetIndex >= next.length) {
          return prev;
        }
        const [card] = next.splice(index, 1);
        next.splice(targetIndex, 0, {...card, updatedAt: Date.now()});
        return next;
      });
    },
    [updateCards]
  );

  const addPlotPoint = useCallback(
    (cardId: string) => {
      const now = Date.now();
      updateCards((prev) =>
        prev.map((card) =>
          card.id === cardId
            ? {
                ...card,
                updatedAt: now,
                plotPoints: [
                  ...card.plotPoints,
                  {
                    id: crypto.randomUUID(),
                    chapterCardId: cardId,
                    title: '',
                    notes: '',
                    order: card.plotPoints.length,
                    createdAt: now,
                    updatedAt: now
                  }
                ]
              }
            : card
        )
      );
    },
    [updateCards]
  );

  const updatePlotPoint = useCallback(
    (
      cardId: string,
      plotPointId: string,
      patch: Partial<Pick<PlotPoint, 'title' | 'notes'>>
    ) => {
      updateCards((prev) =>
        prev.map((card) =>
          card.id === cardId
            ? {
                ...card,
                updatedAt: Date.now(),
                plotPoints: card.plotPoints.map((plotPoint) =>
                  plotPoint.id === plotPointId
                    ? {...plotPoint, ...patch, updatedAt: Date.now()}
                    : plotPoint
                )
              }
            : card
        )
      );
    },
    [updateCards]
  );

  const deletePlotPoint = useCallback(
    (cardId: string, plotPointId: string) => {
      updateCards((prev) =>
        prev.map((card) =>
          card.id === cardId
            ? {
                ...card,
                updatedAt: Date.now(),
                plotPoints: card.plotPoints.filter((plotPoint) => plotPoint.id !== plotPointId)
              }
            : card
        )
      );
    },
    [updateCards]
  );

  const movePlotPoint = useCallback(
    (cardId: string, plotPointId: string, direction: -1 | 1) => {
      updateCards((prev) =>
        prev.map((card) => {
          if (card.id !== cardId) return card;
          const plotPoints = [...card.plotPoints];
          const index = plotPoints.findIndex((plotPoint) => plotPoint.id === plotPointId);
          const targetIndex = index + direction;
          if (index < 0 || targetIndex < 0 || targetIndex >= plotPoints.length) {
            return card;
          }
          const [plotPoint] = plotPoints.splice(index, 1);
          plotPoints.splice(targetIndex, 0, {...plotPoint, updatedAt: Date.now()});
          return {
            ...card,
            updatedAt: Date.now(),
            plotPoints
          };
        })
      );
    },
    [updateCards]
  );

  const totalPlotPoints = useMemo(
    () => cards.reduce((count, card) => count + card.plotPoints.length, 0),
    [cards]
  );

  return {
    corkboardCards: cards,
    corkboardStatus: status,
    corkboardLastSavedAt: lastSavedAt,
    corkboardPlotPointCount: totalPlotPoints,
    createCorkboardCard: createCard,
    updateCorkboardCard: updateCard,
    deleteCorkboardCard: deleteCard,
    moveCorkboardCard: moveCard,
    addCorkboardPlotPoint: addPlotPoint,
    updateCorkboardPlotPoint: updatePlotPoint,
    deleteCorkboardPlotPoint: deletePlotPoint,
    moveCorkboardPlotPoint: movePlotPoint
  };
}
