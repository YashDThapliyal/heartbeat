import { useEffect, useRef } from 'react';
import { CHAPTERS } from '../animation/chapters';

/**
 * Chapter links: opening `/#escapement` starts at that chapter, and the address
 * bar follows along as you move, so any moment can be linked to directly.
 */
export function useChapterLinks(chapterIndex: number, ready: boolean, seek: (p: number) => void): void {
  const arrived = useRef(false);

  useEffect(() => {
    if (!ready || arrived.current) return;
    arrived.current = true;
    const id = window.location.hash.slice(1);
    const chapter = CHAPTERS.find(c => c.id === id);
    if (chapter) seek(chapter.settle);
  }, [ready, seek]);

  useEffect(() => {
    if (!arrived.current) return;
    const id = CHAPTERS[chapterIndex].id;
    const hash = chapterIndex === 0 ? '' : `#${id}`;
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
    }
  }, [chapterIndex]);
}
