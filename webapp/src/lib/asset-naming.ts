import type { Subject } from '@/lib/store';

export function stripExtension(filename?: string | null) {
  if (!filename) return '';
  return filename.replace(/\.[^.]+$/, '');
}

export function normalizeAssetTitle(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/[_-]+/g, ' ')
    .trim();
}

export function slugifyAssetTitle(value: string) {
  const normalized = normalizeAssetTitle(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'gravu-asset';
}

export function buildCombinedSelectionTitle(subjects: Subject[] | null | undefined) {
  const selected = (subjects ?? []).filter((subject) => subject.selected);
  const labels = Array.from(
    new Set(
      selected
    .map((subject) => normalizeAssetTitle(subject.description))
        .filter(Boolean)
    )
  );

  if (labels.length === 0) return 'gravu asset';
  return labels.join(', ');
}

export function findSubjectTitle(subjects: Subject[] | null | undefined, subjectId: number) {
  const match = (subjects ?? []).find((subject) => subject.id === subjectId);
  return match ? normalizeAssetTitle(match.description) : `Asset ${subjectId}`;
}

export function buildDownloadFilename(title: string, extension: string) {
  return `${slugifyAssetTitle(title)}.${extension}`;
}
