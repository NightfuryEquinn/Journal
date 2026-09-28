import { useEffect, useRef, useState } from 'react';
import { CaretLeftIcon, CaretRightIcon, DownloadSimpleIcon, XIcon } from '@phosphor-icons/react';
import { Btn } from './hud';
import type { JournalEntry } from './types';

interface PreviewImage {
  url: string;
  filename: string;
}

export function JournalExportDialog({
  entry,
  onClose,
}: {
  entry: JournalEntry;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [images, setImages] = useState<PreviewImage[]>([]);
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const opener = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const urls: string[] = [];
    setImages([]);
    setIndex(0);
    setTotal(0);
    setError('');
    setBusy(true);
    void import('./journal-export')
      .then(({ generateJournalImages }) =>
        generateJournalImages(entry, controller.signal, (image, _current, count) => {
          const url = URL.createObjectURL(image.blob);
          urls.push(url);
          setImages((previous) => [...previous, { url, filename: image.filename }]);
          setTotal(count);
        }),
      )
      .catch(() => {
        if (!controller.signal.aborted) setError('Image generation failed. Please retry.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => {
      controller.abort();
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [entry, attempt]);

  const selected = images[index];
  const save = () => {
    if (!selected) return;
    const link = document.createElement('a');
    link.href = selected.url;
    link.download = selected.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="journal-export-title"
      aria-describedby="journal-export-description"
      className="m-auto max-h-[92dvh] w-[min(680px,94vw)] overflow-auto border border-line-strong bg-bg-1 p-0 text-fg backdrop:bg-black/80 backdrop:backdrop-blur-xs"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-bg-1 px-4 py-3">
        <h2 id="journal-export-title" className="font-mono text-ui tracking-[0.14em]">
          SAVE JOURNAL
        </h2>
        <Btn variant="ghost" onClick={onClose} aria-label="Close image preview">
          <XIcon className="size-4" /> CLOSE
        </Btn>
      </div>
      <div className="p-4">
        <p id="journal-export-description" className="mb-3 text-body text-fg-dim">
          1080 × 1350 PNG · Save each page in order for your Instagram post.
        </p>
        <p role="status" className="mb-3 font-mono text-meta text-accent">
          {busy
            ? total
              ? `GENERATING · ${images.length} / ${total} PAGES`
              : 'PREPARING IMAGES…'
            : error
              ? 'EXPORT INCOMPLETE'
              : `${total} ${total === 1 ? 'PAGE' : 'PAGES'} READY`}
        </p>
        {error && (
          <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 text-body text-bad">
            <span>{error}</span>
            <Btn onClick={() => setAttempt((value) => value + 1)}>RETRY</Btn>
          </div>
        )}
        {selected && (
          <>
            <img
              src={selected.url}
              width={1080}
              height={1350}
              alt={`Journal image preview, page ${index + 1} of ${total}`}
              className="block h-auto w-full border border-line-strong"
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Btn
                  variant="ghost"
                  disabled={index === 0}
                  onClick={() => setIndex((value) => value - 1)}
                  aria-label="Previous image"
                >
                  <CaretLeftIcon className="size-4" />
                </Btn>
                <span className="font-mono text-meta" aria-live="polite">
                  {index + 1} / {total}
                </span>
                <Btn
                  variant="ghost"
                  disabled={index + 1 >= images.length}
                  onClick={() => setIndex((value) => value + 1)}
                  aria-label="Next image"
                >
                  <CaretRightIcon className="size-4" />
                </Btn>
              </div>
              <Btn variant="primary" onClick={save}>
                <DownloadSimpleIcon className="size-4" /> SAVE IMAGE {index + 1}
              </Btn>
            </div>
            <p className="mt-3 text-ui text-fg-dim">
              On mobile, you can also touch and hold the image to save it.
            </p>
          </>
        )}
      </div>
    </dialog>
  );
}
